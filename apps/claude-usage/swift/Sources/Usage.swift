import Foundation

// MARK: - Models

struct LimitRow: Identifiable, Equatable {
    let id: String          // session | weekly | fable
    var percent: Double
    var resetsAt: Date?

    /// human name for the bucket, used in the panel and the menu bar
    var label: String {
        switch id {
        case "session": return "Session"
        case "weekly":  return "Weekly"
        case "fable":   return "Fable"
        case "chatgpt": return "ChatGPT"
        default:        return id.capitalized
        }
    }

    var resetText: String {
        guard let r = resetsAt else { return "—" }
        let s = r.timeIntervalSinceNow
        if s <= 0 { return "now" }
        let h = s / 3600
        // Same shape and rounding as chatgpt.com's «Resets in 4d 1h»: rounding up
        // to whole days showed 5d when 4d 1h was left.
        if h >= 24 { return String(format: "%.0fd %.0fh", (h / 24).rounded(.down), h.truncatingRemainder(dividingBy: 24).rounded(.down)) }
        if h >= 1  { return String(format: "%.0fh", h.rounded(.up)) }
        return String(format: "%.0fm", (s / 60).rounded(.up))
    }
    var percentText: String { String(format: "%.2f", percent) }
}


final class UsageEngine {
    // ---- token ----------------------------------------------------------
    /// HTTP status of the last usage call (nil = network error / not tried).
    private(set) var lastStatus: Int?
    private var lastAuthNudge: Date = .distantPast

    /// When the Keychain access token expires (nil = unreadable).
    func tokenExpiry() -> Date? {
        guard let o = keychainOAuth(), let e = (o["expiresAt"] as? NSNumber)?.doubleValue else { return nil }
        return Date(timeIntervalSince1970: e / 1000)
    }

    private func keychainOAuth() -> [String: Any]? {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/security")
        p.arguments = ["find-generic-password", "-s", "Claude Code-credentials", "-w"]
        let pipe = Pipe(); p.standardOutput = pipe; p.standardError = Pipe()
        guard (try? p.run()) != nil else { return nil }
        let d = pipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return (try? JSONSerialization.jsonObject(with: d) as? [String: Any])?["claudeAiOauth"] as? [String: Any]
    }

    /// The access token lasts ~8 h and only the CLI refreshes it, and only on
    /// a path that talks to the server, in the token's last 5 minutes.
    /// `claude auth status` never refreshes (read in the 2.1.307 binary; 3 of 3
    /// runs on 21 Oct left expiresAt unchanged). So in the last 4 minutes, or
    /// after a 401, ask the CLI a one-word question on Haiku: that path refreshes
    /// first. At most every 15 minutes; any open Claude Code chat usually
    /// refreshes earlier, and then this never fires. The app never touches the
    /// refresh token: it rotates, and using it here would log the CLI out.
    static let nudgeWindow: TimeInterval = 240

    static func shouldNudge(expiresAt: Date?, lastStatus: Int?, lastNudge: Date, now: Date) -> Bool {
        let expiring = expiresAt.map { $0 < now.addingTimeInterval(nudgeWindow) } ?? false
        return (expiring || lastStatus == 401) && now.timeIntervalSince(lastNudge) > 900
    }

    /// No chat file, no hooks (no «جواب آماده شد», nothing in .remember), a hard
    /// $0.01 cap, run from a temp dir so no project CLAUDE.md is loaded.
    static let nudgeArgs = ["-p", "ok", "--model", "haiku", "--no-session-persistence",
                            "--max-budget-usd", "0.01", "--settings", #"{"disableAllHooks":true}"#]

    func nudgeCLIAuthIfNeeded(now: Date = Date()) {
        guard Self.shouldNudge(expiresAt: tokenExpiry(), lastStatus: lastStatus,
                               lastNudge: lastAuthNudge, now: now) else { return }
        lastAuthNudge = now
        let before = tokenExpiry()
        guard let bin = Self.claudeBinary() else { FetchLog.write("auth-nudge: claude binary not found"); return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: bin)
        p.arguments = Self.nudgeArgs
        p.currentDirectoryURL = FileManager.default.temporaryDirectory
        p.standardInput = FileHandle.nullDevice
        p.standardOutput = Pipe(); p.standardError = Pipe()
        guard (try? p.run()) != nil else { FetchLog.write("auth-nudge: could not start \(bin)"); return }
        let deadline = Date().addingTimeInterval(60)
        while p.isRunning && Date() < deadline { usleep(200_000) }
        if p.isRunning { p.terminate() }
        let after = tokenExpiry()
        FetchLog.write("auth-nudge: haiku exit=\(p.isRunning ? -1 : p.terminationStatus) expiresAt before=\(FetchLog.ts(before)) after=\(FetchLog.ts(after))")
    }

    static func claudeBinary() -> String? {
        let home = NSHomeDirectory()
        var c = ["\(home)/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]
        let nvm = "\(home)/.nvm/versions/node"
        for v in ((try? FileManager.default.contentsOfDirectory(atPath: nvm)) ?? []).sorted().reversed() {
            c.append("\(nvm)/\(v)/bin/claude")
        }
        return c.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    private func token() throws -> String {
        // CU_FAKE_TOKEN: test hook only — unset in normal runs, so it does nothing there.
        if let fake = ProcessInfo.processInfo.environment["CU_FAKE_TOKEN"], !fake.isEmpty { return fake }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/security")
        p.arguments = ["find-generic-password", "-s", "Claude Code-credentials", "-w"]
        let pipe = Pipe(); p.standardOutput = pipe; p.standardError = Pipe()
        try p.run()
        let d = pipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        guard let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let oauth = j["claudeAiOauth"] as? [String: Any],
              let t = oauth["accessToken"] as? String else {
            throw NSError(domain: "usage", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "token not found in Keychain"])
        }
        return t
    }

    // ---- account limits --------------------------------------------------
    func fetchLimits() async throws -> [LimitRow] {
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/api/oauth/usage")!)
        req.setValue("Bearer \(try token())", forHTTPHeaderField: "Authorization")
        req.setValue("oauth-2025-04-20", forHTTPHeaderField: "anthropic-beta")
        req.timeoutInterval = 15
        let (data, resp): (Data, URLResponse)
        do { (data, resp) = try await URLSession.shared.data(for: req) }
        catch { lastStatus = nil; FetchLog.write("fetch: network \(error.localizedDescription)"); throw error }
        lastStatus = (resp as? HTTPURLResponse)?.statusCode
        if lastStatus != 200 {
            FetchLog.write("fetch: HTTP \(lastStatus ?? -1) expiresAt=\(FetchLog.ts(tokenExpiry()))")
        }
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(domain: "usage", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "usage \((resp as? HTTPURLResponse)?.statusCode ?? -1)"])
        }
        let j = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        return Self.parseLimits(j)
    }

    /// The three bars from the usage response (definition 01).
    static func parseLimits(_ j: [String: Any]) -> [LimitRow] {
        let limits = j["limits"] as? [[String: Any]] ?? []
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso2 = ISO8601DateFormatter()

        func parse(_ s: Any?) -> Date? {
            guard let s = s as? String else { return nil }
            return iso.date(from: s) ?? iso2.date(from: s)
        }
        func pick(_ kind: String, _ scopeName: String? = nil) -> [String: Any]? {
            limits.first { l in
                guard (l["kind"] as? String) == kind else { return false }
                guard let want = scopeName else { return true }
                let scope = l["scope"] as? [String: Any]
                let model = scope?["model"] as? [String: Any]
                return (model?["display_name"] as? String) == want
            }
        }
        // limits[].percent is a whole number; the top-level buckets carry the
        // fractional value, so prefer those when present.
        func util(_ key: String) -> Double? {
            ((j[key] as? [String: Any])?["utilization"] as? NSNumber)?.doubleValue
        }
        var out: [LimitRow] = []
        for (id, l, fine) in [("session", pick("session"), util("five_hour")),
                              ("weekly", pick("weekly_all"), util("seven_day")),
                              ("fable", pick("weekly_scoped", "Fable"), nil)] {
            guard let l else { continue }
            out.append(LimitRow(id: id,
                                percent: fine ?? (l["percent"] as? NSNumber)?.doubleValue ?? 0,
                                resetsAt: parse(l["resets_at"])))
        }
        return out
    }
}

/// ChatGPT's weekly percentage («درصد چت جی پی تی رو هم بیاری توی اون منوبار»,
/// 5 Nov). Asked from Codex's own app-server, which holds the login and spends
/// no quota; this app never reads ~/.codex/auth.json.
enum ChatGPTUsage {
    static let requests = [
        #"{"id":1,"method":"initialize","params":{"clientInfo":{"name":"ClaudeUsage","version":"2"}}}"#,
        #"{"method":"initialized"}"#,
        #"{"id":2,"method":"account/rateLimits/read"}"#,
    ].joined(separator: "\n") + "\n"

    static func binary() -> String? {
        let home = NSHomeDirectory()
        var c = ["\(home)/.codex/packages/app-server-daemon/current/bin/codex"]
        for root in [".vscode", ".windsurf", ".cursor"] {
            let ext = "\(home)/\(root)/extensions"
            for d in ((try? FileManager.default.contentsOfDirectory(atPath: ext)) ?? []).sorted().reversed()
            where d.hasPrefix("openai.chatgpt-") {
                c.append("\(ext)/\(d)/bin/macos-aarch64/codex")
            }
        }
        return c.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    /// One JSON line of the app-server's answer; nil unless it is the rate-limits reply.
    static func parse(_ line: Data) -> LimitRow? {
        guard let j = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
              (j["id"] as? NSNumber)?.intValue == 2,
              let r = j["result"] as? [String: Any],
              let limits = r["rateLimits"] as? [String: Any],
              let p = limits["primary"] as? [String: Any],
              let used = (p["usedPercent"] as? NSNumber)?.doubleValue else { return nil }
        return LimitRow(id: "chatgpt", percent: used,
                        resetsAt: (p["resetsAt"] as? NSNumber).map { Date(timeIntervalSince1970: $0.doubleValue) })
    }

    /// Blocking, at most 15 s; call off the main thread.
    static func fetch() -> LimitRow? {
        guard let bin = binary() else { FetchLog.write("chatgpt: codex binary not found"); return nil }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: bin)
        p.arguments = ["app-server"]
        p.currentDirectoryURL = FileManager.default.temporaryDirectory
        let input = Pipe(), output = Pipe()
        p.standardInput = input; p.standardOutput = output; p.standardError = FileHandle.nullDevice
        guard (try? p.run()) != nil else { FetchLog.write("chatgpt: could not start \(bin)"); return nil }
        // Terminating closes stdout, which ends the read loop below.
        let killer = DispatchWorkItem { if p.isRunning { p.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 15, execute: killer)
        defer {
            killer.cancel()
            if p.isRunning { p.terminate() }
            try? input.fileHandleForWriting.close()
            p.waitUntilExit()
        }
        try? input.fileHandleForWriting.write(contentsOf: Data(requests.utf8))
        var buf = Data()
        while true {
            let chunk = output.fileHandleForReading.availableData
            if chunk.isEmpty { break }
            buf.append(chunk)
            while let nl = buf.firstIndex(of: 10) {
                let line = buf.subdata(in: buf.startIndex..<nl)
                buf.removeSubrange(buf.startIndex...nl)
                if let row = parse(line) { return row }
            }
        }
        FetchLog.write("chatgpt: no rate limits in the answer")
        return nil
    }
}

enum FetchLog {
    static let url = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/ClaudeUsage-fetch.log")
    static func ts(_ d: Date?) -> String { d.map { ISO8601DateFormatter().string(from: $0) } ?? "nil" }
    /// Every notification handed to macOS and whether it really landed among
    /// the delivered ones (definitions 02 and 03).
    static let notifyURL = url.deletingLastPathComponent().appendingPathComponent("ClaudeUsage-notify.log")
    static func write(_ s: String, to url: URL = url) {
        let line = Data("\(ts(Date())) \(s)\n".utf8)
        if let h = try? FileHandle(forWritingTo: url) { _ = try? h.seekToEnd(); try? h.write(contentsOf: line); try? h.close() }
        else { try? line.write(to: url) }
    }
}
