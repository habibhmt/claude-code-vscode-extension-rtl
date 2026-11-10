import Foundation
import UserNotifications

/// The two alarms kept with the percentages (30 Oct 04:55: «نه این دوتا هم
/// بمونن با درصدها — بقیه برن»): «جواب آماده شد» (definition 02) and the
/// cache chime (definition 03). Only chats touched in the last 65 minutes are
/// looked at — an older one can no longer finish an answer or reach a cache
/// mark — and an unchanged file is never opened, so a quiet tick is a handful
/// of stat calls.
final class Alarms {
    let root: URL
    init(root: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude/projects")) {
        self.root = root
    }

    struct Chat { var mtime: Date; var size: Int; var t: Transcript }
    private(set) var chats: [String: Chat] = [:]
    private var seenEndTurn: [String: String] = [:]
    private var cacheRung: [String: (Double, Int)] = [:]
    private var firstScan = true
    private var replyGate = Rules.ReplyGate()
    /// Tests set this to catch notifications instead of handing them to macOS.
    var sink: ((String, UNMutableNotificationContent) -> Void)?

    static let window: TimeInterval = 65 * 60
    /// New files read per tick (each first read takes up to 3 MB).
    static let firstReadsPerTick = 5
    /// CLAUDE_CACHE_TEST=1 turns minutes into 2-second steps for testing.
    static let markUnit: Double =
        ProcessInfo.processInfo.environment["CLAUDE_CACHE_TEST"] == "1" ? 2 : 60

    private var listing: [String: (mtime: Double, files: [String])] = [:]

    /// Files modified within the window: path → (mtime, size).
    func recentFiles(now: Date) -> [String: (Date, Int)] {
        let fm = FileManager.default
        var out: [String: (Date, Int)] = [:]
        for dir in (try? fm.contentsOfDirectory(atPath: root.path)) ?? [] {
            let full = root.appendingPathComponent(dir).path
            // A folder is listed again only when its own mtime moves (a chat
            // file was added or removed); listing all of them every tick was
            // half the remaining CPU.
            var ds = stat()
            guard stat(full, &ds) == 0 else { continue }
            let dm = Double(ds.st_mtimespec.tv_sec) + Double(ds.st_mtimespec.tv_nsec) / 1e9
            if listing[full]?.mtime != dm {
                let names = ((try? fm.contentsOfDirectory(atPath: full)) ?? []).filter { $0.hasSuffix(".jsonl") }
                listing[full] = (dm, names.map { (full as NSString).appendingPathComponent($0) })
            }
            for p in listing[full]?.files ?? [] {
                // Plain stat(): attributesOfItem on ~1100 files every 5 s was
                // the app's whole CPU (2.4%, `sample`, 30 Oct).
                var st = stat()
                guard stat(p, &st) == 0 else { continue }
                let m = Date(timeIntervalSince1970: Double(st.st_mtimespec.tv_sec)
                             + Double(st.st_mtimespec.tv_nsec) / 1e9)
                guard now.timeIntervalSince(m) < Self.window else { continue }
                out[p] = (m, Int(st.st_size))
            }
        }
        return out
    }

    /// Reads what changed; returns the chats to check.
    func scan(now: Date = Date()) {
        let files = recentFiles(now: now)
        chats = chats.filter { files[$0.key] != nil }
        var fresh = 0
        for (p, (m, s)) in files.sorted(by: { $0.value.0 > $1.value.0 }) {
            if let c = chats[p], c.mtime == m, c.size == s { continue }
            if chats[p] == nil { if fresh >= Self.firstReadsPerTick { continue }; fresh += 1 }
            var t = chats[p]?.t ?? Transcript()
            t.update(path: p, now: now)
            chats[p] = Chat(mtime: m, size: s, t: t)
        }
    }

    func tick(now: Date = Date()) {
        scan(now: now)
        for (p, c) in chats {
            // 30 Oct 14:55: the «۲۰۳-پیام رسان (خودکار)» chats (claude -p, not
            // him) get no alarm at all — matched by name, since ~1 in 6 of
            // them carries no sdk-cli entrypoint.
            if Self.automatic(c.t) { continue }
            let id = ((p as NSString).lastPathComponent as NSString).deletingPathExtension
            finished(id: id, path: p, t: c.t)
            cache(id: id, path: p, t: c.t, now: now)
        }
        firstScan = false
    }

    private func finished(id: String, path: String, t: Transcript) {
        guard let e = t.endTurn else { return }
        let prev = seenEndTurn[id]
        seenEndTurn[id] = e
        guard Rules.finished(prev: prev, now: e, firstScan: firstScan) else { return }
        let verdict = replyGate.verdict(chat: id, fromHuman: t.turnFromHuman)
        if verdict == .skip { return }
        let txt = Rules.finishedText(ctxTokens: t.ctxTokens, ctxText: Self.thousands(t.ctxTokens),
                                     model: Self.modelShort(t.model))
        let n = UNMutableNotificationContent()
        n.title = txt.title
        n.subtitle = Self.who(path, t)
        n.body = txt.body
        // Over the hourly cap the answer still lands in the list, silently.
        if verdict == .banner {
            n.sound = UNNotificationSound(named: UNNotificationSoundName("ClaudeReply.aiff"))
            n.interruptionLevel = .active
        } else {
            n.interruptionLevel = .passive
        }
        // One id per chat: a newer answer replaces the older entry.
        send(n, kind: "reply-\(verdict)", id: "reply-\(id)")
    }

    private func cache(id: String, path: String, t: Transcript, now: Date) {
        guard t.endTurnAt > 0,
              let mark = Rules.cacheMark(elapsed: now.timeIntervalSince1970 - t.endTurnAt, unit: Self.markUnit)
        else { return }
        // A new answer restarts the count; each mark rings once.
        if let r = cacheRung[id], r.0 == t.endTurnAt, r.1 >= mark { return }
        cacheRung[id] = (t.endTurnAt, mark)
        if firstScan { return }
        let txt = Rules.cacheText(mark: mark, ctxText: Self.thousands(t.ctxTokens))
        let n = UNMutableNotificationContent()
        n.title = txt.title
        n.subtitle = Self.who(path, t)
        n.body = txt.body
        // Every chat gets the chime; an agent's chat lands silently in the list.
        let loud = Rules.cacheLoud(fromHuman: t.turnFromHuman)
        n.sound = loud ? UNNotificationSound(named: UNNotificationSoundName("ClaudeCache.aiff")) : nil
        n.interruptionLevel = loud ? .active : .passive
        send(n, kind: "cache-\(mark)\(loud ? "" : "-silent")")
    }

    private func send(_ n: UNMutableNotificationContent, kind: String, id: String = UUID().uuidString) {
        if let sink { sink(kind, n) } else { Self.post(n, kind: kind, id: id) }
    }

    static func automatic(_ t: Transcript) -> Bool { t.customTitle.contains("(خودکار)") }

    // MARK: text
    static func thousands(_ n: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = ","
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }
    static func modelShort(_ m: String) -> String {
        var v = m.replacingOccurrences(of: "claude-", with: "")
        if let r = v.range(of: "-20\\d{6,}.*$", options: .regularExpression) { v.removeSubrange(r) }
        return v
    }
    /// Full folder name (he has several 91th-* folders), plus the name he typed on the chat.
    static func who(_ file: String, _ t: Transcript) -> String {
        let dir = ((file as NSString).deletingLastPathComponent as NSString).lastPathComponent
        var name = dir.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        if let r = dir.range(of: "1-MY-WORK-") {
            let rest = String(dir[r.upperBound...])
            let work = (NSHomeDirectory() as NSString).appendingPathComponent("1-MY-WORK")
            let names = (try? FileManager.default.contentsOfDirectory(atPath: work)) ?? []
            name = names.filter { rest == $0 || rest.hasPrefix($0 + "-") }.max(by: { $0.count < $1.count }) ?? rest
        }
        return t.customTitle.isEmpty ? name : "\(name) · \(t.customTitle)"
    }

    /// Hands a banner to macOS and logs it to ClaudeUsage-notify.log.
    static func post(_ n: UNMutableNotificationContent, kind: String, id: String = UUID().uuidString) {
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: n, trigger: nil)) { err in
            FetchLog.write("\(kind) \(id) \(err.map { "add-failed \($0.localizedDescription)" } ?? "added")",
                           to: FetchLog.notifyURL)
        }
    }
}
