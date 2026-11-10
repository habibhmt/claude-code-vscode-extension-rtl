import AppKit
import UserNotifications

let kBundleID = "com.habib.ClaudeUsage.v5"

/// 30 Oct 04:46, after the CPU guard closed the app at ~30%: «فیچرهای اضافت رو
/// پاک کن و فقط همون درصد ها فقط بمونه»; 04:55: «نه این دوتا هم بمونن با
/// درصدها — بقیه برن». Left: the three percentages (one usage call every 5
/// minutes) and the two alarms in Alarms.swift. No panel, no advisor.
final class AppDelegate: NSObject, NSApplicationDelegate {
    let engine = UsageEngine()
    var item: NSStatusItem!
    var rows: [LimitRow] = AppDelegate.loadRows()
    var lastOK: Date?
    var chatgptOK: Date?
    var fetching = false
    var timer: Timer?
    let alarms = Alarms()
    var alarmTimer: Timer?
    /// limits endpoint: 5 min, doubling on 429
    static let baseInterval: TimeInterval = 300
    var backoff: TimeInterval = AppDelegate.baseInterval

    /// Last known percentages, so a restart shows numbers before the first fetch.
    static func loadRows() -> [LimitRow] {
        guard let a = UserDefaults.standard.array(forKey: "lastRows") as? [[String: Any]] else { return [] }
        return a.compactMap { d in
            guard let id = d["id"] as? String, let p = d["p"] as? Double else { return nil }
            return LimitRow(id: id, percent: p,
                            resetsAt: (d["r"] as? Double).map { Date(timeIntervalSince1970: $0) })
        }
    }
    static func saveRows(_ rows: [LimitRow]) {
        UserDefaults.standard.set(rows.map { r -> [String: Any] in
            var d: [String: Any] = ["id": r.id, "p": r.percent]
            if let a = r.resetsAt { d["r"] = a.timeIntervalSince1970 }
            return d
        }, forKey: "lastRows")
    }

    /// Numbers older than 30 minutes are greyed out: the token may have expired.
    var stale: Bool { lastOK.map { Date().timeIntervalSince($0) > 1800 } ?? true }
    var chatgptStale: Bool { chatgptOK.map { Date().timeIntervalSince($0) > 1800 } ?? true }
    private func isStale(_ r: LimitRow) -> Bool { r.id == "chatgpt" ? chatgptStale : stale }

    // MARK: menu bar
    private func renderTitle() {
        guard let b = item?.button else { return }
        guard !rows.isEmpty else { b.attributedTitle = NSAttributedString(string: " …"); return }
        let font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        let out = NSMutableAttributedString(string: " ")
        for (i, r) in rows.enumerated() {
            if i > 0 { out.append(NSAttributedString(string: r.id == "chatgpt" ? " | " : "·", attributes: [
                .font: font, .foregroundColor: NSColor.secondaryLabelColor])) }
            out.append(NSAttributedString(string: String(format: "%.0f%%", r.percent), attributes: [
                .font: font,
                .foregroundColor: isStale(r) ? NSColor.tertiaryLabelColor
                                : r.percent >= 90 ? NSColor.systemRed
                                : r.percent >= 70 ? NSColor.systemOrange : NSColor.labelColor,
            ]))
        }
        b.attributedTitle = out
    }

    /// Click: the three rows with their reset times, Refresh and Quit.
    private func rebuildMenu() {
        let m = NSMenu()
        for r in rows {
            m.addItem(NSMenuItem(title: "\(r.label)  \(String(format: "%.0f%%", r.percent))  ↻ \(r.resetText)",
                                 action: nil, keyEquivalent: ""))
        }
        if rows.contains(where: isStale) { m.addItem(NSMenuItem(title: "⚠︎ numbers are old", action: nil, keyEquivalent: "")) }
        m.addItem(.separator())
        let refresh = NSMenuItem(title: "Refresh", action: #selector(refreshNow), keyEquivalent: "r")
        refresh.target = self
        m.addItem(refresh)
        m.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        item.menu = m
    }

    // MARK: data
    @objc func refreshNow() { Task { await refresh() } }

    @MainActor
    func refresh() async {
        guard !fetching else { return }
        fetching = true
        defer { fetching = false }
        // Expiring or rejected token: ask the CLI to refresh it (never ourselves).
        await Task.detached { [engine] in engine.nudgeCLIAuthIfNeeded() }.value
        do {
            rows = try await engine.fetchLimits() + rows.filter { $0.id == "chatgpt" }
            lastOK = Date()
            backoff = Self.baseInterval
            Self.saveRows(rows)
        } catch {
            if error.localizedDescription.contains("429") { backoff = min(backoff * 2, 3600) }
        }
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastFetchAt")
        await refreshChatGPT()
        schedule(after: backoff)
    }

    /// Separate from Claude's call: a failure of one never touches the other's number.
    @MainActor
    func refreshChatGPT() async {
        if let row = await Task.detached(operation: { ChatGPTUsage.fetch() }).value {
            rows = rows.filter { $0.id != "chatgpt" } + [row]
            chatgptOK = Date()
            Self.saveRows(rows)
        }
        renderTitle()
        rebuildMenu()
    }

    private func schedule(after s: TimeInterval) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: s, repeats: false) { [weak self] _ in
            self?.refreshNow()
        }
        timer?.tolerance = 30
    }

    // MARK: lifecycle
    private func killOtherInstances() {
        let me = ProcessInfo.processInfo.processIdentifier
        let ids = Set([kBundleID, "com.habib.ClaudeUsage"])
        for a in NSWorkspace.shared.runningApplications
        where ids.contains(a.bundleIdentifier ?? "") && a.processIdentifier != me {
            a.forceTerminate()
        }
    }

    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.setActivationPolicy(.accessory)
        killOtherInstances()
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.font = .monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        renderTitle()
        rebuildMenu()
        // A restart within 5 minutes of the last call waits out the rest, so
        // restarting never triggers a 429.
        let last = UserDefaults.standard.double(forKey: "lastFetchAt")
        let wait = last > 0 ? max(0, last + Self.baseInterval - Date().timeIntervalSince1970) : 0
        if wait == 0 { refreshNow() } else {
            schedule(after: wait)
            Task { await refreshChatGPT() }
        }

        // Without a delegate macOS files notifications silently whenever it
        // counts this app as frontmost: no banner, no sound.
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let t = Timer(timeInterval: 5, repeats: true) { [weak self] _ in self?.alarms.tick() }
        t.tolerance = 1
        RunLoop.main.add(t, forMode: .common)
        alarmTimer = t
        alarms.tick()
    }
}

@main
enum Main {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .list, .sound])
    }
}
