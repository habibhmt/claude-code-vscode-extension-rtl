import Foundation

/// One chat transcript, read a piece at a time. The first read takes the last
/// 3 MB; after that only the bytes appended since the previous read are parsed,
/// so a busy chat costs a few KB every tick instead of 3 MB (21 Oct: re-reading
/// the whole tail every 2 s was 93% of the main thread's work).
struct Transcript {
    static let firstRead = 3 << 20

    private(set) var offset: UInt64 = 0
    var cwd = "", title = "", customTitle = "", model = ""
    var ctxTokens = 0
    var endTurn: String?
    var latestAssistantAt: TimeInterval = -1
    var endTurnAt: TimeInterval = -1
    /// Who started the current turn: Habib typing (true) or another agent / a
    /// background task (false). The reply-banner cap only applies to the latter.
    var turnFromHuman = true
    /// Weighted cost of every answer, kept so the 5 h / 7 d windows can slide
    /// without reading the file again.
    private(set) var costs: [(ts: TimeInterval, cost: Double, fable: Bool)] = []

    private static let modelW: [(String, Double)] =
        [("opus", 5), ("fable", 5), ("sonnet", 1), ("haiku", 0.2)]

    static func weight(_ model: String) -> Double {
        let m = model.lowercased()
        for (k, v) in modelW where m.contains(k) { return v }
        return 1
    }

    /// Read whatever was appended since the last call. A file that shrank was
    /// rewritten, so it is read again from scratch.
    mutating func update(path: String, now: Date = Date()) {
        guard let fh = FileHandle(forReadingAtPath: path) else { return }
        defer { try? fh.close() }
        let size = (try? fh.seekToEnd()) ?? 0
        if size < offset { self = Transcript() }
        if size == offset { prune(now); return }
        var start = offset
        var skipFirst = false
        if offset == 0 && size > UInt64(Self.firstRead) {
            start = size - UInt64(Self.firstRead)
            skipFirst = true          // landed mid-line
        }
        try? fh.seek(toOffset: start)
        guard let data = try? fh.read(upToCount: Int(size - start)), !data.isEmpty else { return }
        // Only whole lines: a line still being written is read next time.
        guard let lastNL = data.lastIndex(of: 0x0A) else {
            if skipFirst { offset = size }
            return
        }
        var body = data[data.startIndex...lastNL]
        if skipFirst, let nl = body.firstIndex(of: 0x0A) { body = body[body.index(after: nl)...] }
        autoreleasepool {
            for line in body.split(separator: 0x0A, omittingEmptySubsequences: true) {
                feed(Data(line))
            }
        }
        offset = start + UInt64(lastNL - data.startIndex + 1)
        // The name may sit before the 3 MB tail, and the «(خودکار)» alarm guard
        // depends on it. Inside a JSON string the quotes are escaped, so this
        // exact text only matches a real record.
        if skipFirst && customTitle.isEmpty { customTitle = Self.earlierTitle(path: path, before: start) }
        prune(now)
    }

    /// The newest name in the first `before` bytes of the file, or "".
    static func earlierTitle(path: String, before: UInt64) -> String {
        guard let all = try? Data(contentsOf: URL(fileURLWithPath: path), options: .alwaysMapped) else { return "" }
        let head = all[all.startIndex..<(all.startIndex + Int(min(before, UInt64(all.count))))]
        let mark = Data(#"{"type":"custom-title""#.utf8)
        guard let r = head.range(of: mark, options: .backwards),
              let nl = all[r.lowerBound...].firstIndex(of: 0x0A),
              let e = try? JSONSerialization.jsonObject(with: Data(all[r.lowerBound..<nl])) as? [String: Any]
        else { return "" }
        return e["customTitle"] as? String ?? ""
    }

    private mutating func prune(_ now: Date) {
        let t7 = now.addingTimeInterval(-7 * 86400).timeIntervalSince1970
        if let first = costs.first, first.ts < t7 { costs.removeAll { $0.ts < t7 } }
    }

    /// Weighted cost in the last 5 h, last 7 d, and the Fable share of the 7 d.
    func totals(now: Date) -> (w5: Double, w7: Double, f7: Double) {
        let t5 = now.addingTimeInterval(-5 * 3600).timeIntervalSince1970
        let t7 = now.addingTimeInterval(-7 * 86400).timeIntervalSince1970
        var r = (w5: 0.0, w7: 0.0, f7: 0.0)
        for c in costs where c.ts >= t7 {
            r.w7 += c.cost
            if c.fable { r.f7 += c.cost }
            if c.ts >= t5 { r.w5 += c.cost }
        }
        return r
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let iso2: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()

    /// nil = this record does not start a turn (a tool result, or a skill's
    /// meta text the agent loaded mid-turn). A message he typed while the agent
    /// was busy arrives as a queued_command attachment. Records from older CLIs
    /// carry no origin and count as his, so none of his answers lose the banner.
    static func turnSource(_ e: [String: Any]) -> Bool? {
        let kind = (e["origin"] as? [String: Any])?["kind"] as? String
        if (e["type"] as? String) == "attachment" {
            guard let a = e["attachment"] as? [String: Any],
                  (a["type"] as? String) == "queued_command" else { return nil }
            // Peer messages and task notifications are queued the same way; their
            // origin sits on the attachment, and older ones only say commandMode.
            if let k = (a["origin"] as? [String: Any])?["kind"] as? String ?? kind { return k == "human" }
            if (a["commandMode"] as? String) == "task-notification" { return false }
            let text = (a["prompt"] as? String) ?? ""
            return !text.hasPrefix("<task-notification") && !text.contains("<cross-session-message")
        }
        guard (e["type"] as? String) == "user" else { return nil }
        if let parts = (e["message"] as? [String: Any])?["content"] as? [[String: Any]],
           parts.contains(where: { ($0["type"] as? String) == "tool_result" }) { return nil }
        if let kind { return kind == "human" }
        if (e["isMeta"] as? Bool) == true { return nil }
        return true
    }

    mutating func feed(_ line: Data) {
        guard let e = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { return }
        if let c = e["cwd"] as? String, !c.isEmpty { cwd = c }
        if (e["type"] as? String) == "ai-title", let t = e["aiTitle"] as? String { title = t }
        // A name he typed himself beats any auto-generated title.
        if (e["type"] as? String) == "custom-title",
           let t = e["customTitle"] as? String, !t.isEmpty { customTitle = t }
        // Any user record (a new question or a tool result) after the
        // last finished answer means the chat is busy again.
        // (file order, not timestamps — they can tie to the millisecond).
        if (e["type"] as? String) == "user" { endTurnAt = -1 }
        if let h = Self.turnSource(e) { turnFromHuman = h }
        guard (e["type"] as? String) == "assistant",
              let msg = e["message"] as? [String: Any],
              let u = msg["usage"] as? [String: Any] else { return }

        let ts = (e["timestamp"] as? String)
            .flatMap { Self.iso.date(from: $0) ?? Self.iso2.date(from: $0) }?
            .timeIntervalSince1970 ?? 0
        let m = msg["model"] as? String ?? ""
        func n(_ k: String) -> Int { (u[k] as? NSNumber)?.intValue ?? 0 }
        let ctx = n("input_tokens") + n("cache_read_input_tokens") + n("cache_creation_input_tokens")
        if ts >= latestAssistantAt {
            latestAssistantAt = ts
            if !m.isEmpty { model = m }
            ctxTokens = ctx
            if (msg["stop_reason"] as? String) == "end_turn" {
                endTurn = (e["uuid"] as? String) ?? String(ts)
                endTurnAt = ts
            } else {
                endTurnAt = -1
            }
        }
        let cost = Self.weight(m) * (Double(n("input_tokens"))
                 + 1.25 * Double(n("cache_creation_input_tokens"))
                 + 0.10 * Double(n("cache_read_input_tokens"))
                 + 5.00 * Double(n("output_tokens")))
        costs.append((ts, cost, m.lowercased().contains("fable")))
    }
}
