import Foundation

// MARK: - Time helpers

/// The trace writes `2026-11-18T03:42:28.117537+00:00` (microseconds) while
/// transcripts write `2026-11-18T03:42:28.117Z` (milliseconds). ISO8601DateFormatter
/// stops at three fractional digits, so the six-digit form needs its own parser.
enum ORTime {
    private static let frac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    private static let micro: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX"
        return f
    }()
    private static let outFmt: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    private static let dayFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func date(_ s: String) -> Date? {
        frac.date(from: s) ?? micro.date(from: s) ?? plain.date(from: s)
    }
    static func string(_ d: Date) -> String { outFmt.string(from: d) }
    /// OpenRouter's activity/key endpoints report days in UTC; the app's "today"
    /// matches them so the number does not jump at Tehran midnight.
    static func utcDay(_ d: Date = Date()) -> String { dayFmt.string(from: d) }

    /// Midnight UTC of the given instant. The collector prices only requests at
    /// or after this, so a first run does not spend minutes pricing the whole
    /// trace history — the panel only ever shows today anyway.
    static func utcDayStart(_ d: Date = Date()) -> TimeInterval {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0)!
        return cal.startOfDay(for: d).timeIntervalSince1970
    }
}

// MARK: - Keys

enum ORKeys {
    /// `OPENROUTER_API_KEY` comes from the environment first, then `~/.dsh/.env`.
    static func value(_ name: String) -> String? {
        if let v = ProcessInfo.processInfo.environment[name]?.trimmingCharacters(in: .whitespacesAndNewlines), !v.isEmpty {
            return v
        }
        return fromDSHEnv(name)
    }

    static func fromDSHEnv(_ name: String) -> String? {
        let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".dsh/.env")
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        for raw in text.split(whereSeparator: \.isNewline) {
            var line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("#") { continue }
            if line.hasPrefix("export ") { line = String(line.dropFirst(7)).trimmingCharacters(in: .whitespaces) }
            guard let eq = line.firstIndex(of: "=") else { continue }
            let key = line[..<eq].trimmingCharacters(in: .whitespaces)
            guard key == name else { continue }
            var v = line[line.index(after: eq)...].trimmingCharacters(in: .whitespaces)
            if v.count >= 2, (v.hasPrefix("\"") && v.hasSuffix("\"")) || (v.hasPrefix("'") && v.hasSuffix("'")) {
                v = String(v.dropFirst().dropLast())
            }
            return v.isEmpty ? nil : v
        }
        return nil
    }
}

// MARK: - HTTP

enum ORError: Error, CustomStringConvertible {
    case badURL, shape, http(Int)
    var description: String {
        switch self {
        case .badURL: return "bad URL"
        case .shape: return "unexpected JSON shape"
        case .http(let c): return "HTTP \(c)"
        }
    }
}

enum ORHTTP {
    static func get(_ s: String, bearer: String?, timeout: TimeInterval = 20) async throws -> (Data, Int) {
        guard let url = URL(string: s) else { throw ORError.badURL }
        var r = URLRequest(url: url)
        r.timeoutInterval = timeout
        r.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        if let bearer { r.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        let (data, resp) = try await URLSession.shared.data(for: r)
        return (data, (resp as? HTTPURLResponse)?.statusCode ?? -1)
    }
}

// MARK: - OpenRouter API

struct Credit { var total: Double; var used: Double; var remaining: Double }

struct DaySpend { var spend = 0.0; var requests = 0; var found = false }

struct Generation {
    var cost: Double
    var provider: String
    var prompt: Int
    var cached: Int
    var completion: Int
    var model: String
}

enum ORClient {
    static let base = "https://openrouter.ai/api/v1"

    static func credits(_ key: String) async throws -> Credit {
        let (d, code) = try await ORHTTP.get(base + "/credits", bearer: key)
        guard code == 200 else { throw ORError.http(code) }
        guard let j = try JSONSerialization.jsonObject(with: d) as? [String: Any],
              let data = j["data"] as? [String: Any],
              let total = (data["total_credits"] as? NSNumber)?.doubleValue,
              let used = (data["total_usage"] as? NSNumber)?.doubleValue else { throw ORError.shape }
        return Credit(total: total, used: used, remaining: total - used)
    }

    /// Rows are per model/provider/endpoint and day; only the requested UTC day is summed.
    static func activityToday(_ key: String, day: String) async throws -> DaySpend {
        let (d, code) = try await ORHTTP.get(base + "/activity", bearer: key)
        guard code == 200 else { throw ORError.http(code) }
        guard let j = try JSONSerialization.jsonObject(with: d) as? [String: Any],
              let rows = j["data"] as? [[String: Any]] else { throw ORError.shape }
        var out = DaySpend()
        for r in rows {
            guard let date = r["date"] as? String, date.hasPrefix(day) else { continue }
            out.found = true
            out.spend += (r["usage"] as? NSNumber)?.doubleValue ?? 0
            out.requests += (r["requests"] as? NSNumber)?.intValue ?? 0
        }
        return out
    }

    static func usageDaily(_ key: String) async throws -> Double {
        let (d, code) = try await ORHTTP.get(base + "/key", bearer: key)
        guard code == 200 else { throw ORError.http(code) }
        guard let j = try JSONSerialization.jsonObject(with: d) as? [String: Any],
              let data = j["data"] as? [String: Any] else { throw ORError.shape }
        return (data["usage_daily"] as? NSNumber)?.doubleValue ?? 0
    }

    /// nil = 404, meaning OpenRouter has not finished recording it yet. The caller
    /// deliberately does NOT cache that as a price, so the next pass retries it.
    static func generation(id: String, key: String) async throws -> Generation? {
        var comps = URLComponents(string: base + "/generation")!
        comps.queryItems = [URLQueryItem(name: "id", value: id)]
        guard let url = comps.url?.absoluteString else { throw ORError.badURL }
        let (d, code) = try await ORHTTP.get(url, bearer: key)
        if code == 404 { return nil }
        guard code == 200 else { throw ORError.http(code) }
        guard let j = try JSONSerialization.jsonObject(with: d) as? [String: Any],
              let data = j["data"] as? [String: Any],
              let usage = (data["usage"] as? NSNumber)?.doubleValue else { throw ORError.shape }
        return Generation(cost: usage,
                          provider: data["provider_name"] as? String ?? "",
                          prompt: (data["tokens_prompt"] as? NSNumber)?.intValue ?? 0,
                          cached: (data["native_tokens_cached"] as? NSNumber)?.intValue ?? 0,
                          completion: (data["tokens_completion"] as? NSNumber)?.intValue ?? 0,
                          model: data["model"] as? String ?? "")
    }
}

// MARK: - VPN (country) check

/// OpenRouter is unreachable from Iran without a VPN; checking the exit country
/// with Cloudflare's plain-text trace is cheaper and safer than a failed API call.
final class VPNProbe {
    static let cacheTTL: TimeInterval = 300

    private var cached: (country: String?, at: Date)?

    func country(now: Date = Date()) async -> String? {
        if let c = cached, now.timeIntervalSince(c.at) < Self.cacheTTL { return c.country }
        var found: String? = nil
        if let (d, code) = try? await ORHTTP.get("https://1.1.1.1/cdn-cgi/trace", bearer: nil, timeout: 10),
           code == 200, let text = String(data: d, encoding: .utf8) {
            for line in text.split(whereSeparator: \.isNewline) where line.hasPrefix("loc=") {
                found = String(line.dropFirst(4)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        cached = (found, now)
        return found
    }
}

// MARK: - Persisted types

/// One priced request, appended to generations.jsonl. `ts` is the request time
/// (epoch seconds, UTC) so attribution never has to re-read the trace.
struct Priced: Codable {
    var id: String
    var cost: Double
    var ts: Double
    var project: String
    var model: String
    var provider: String
    var prompt: Int
    var cached: Int
    var completion: Int
}

struct TraceRecord {
    var time: TimeInterval
    var project: String
    var status: Int?
    var responseID: String
}

// MARK: - Source of truth (file shape)

struct CreditInfo: Codable { var total: Double; var used: Double; var remaining: Double }
struct TodayInfo: Codable { var spend: Double; var requests: Int }
struct ChildInfo: Codable { var kind: String; var label: String; var cost: Double; var count: Int }
struct ChatInfo: Codable {
    var id: String
    var title: String
    var cost: Double
    var last: String
    var live: Bool
    var children: [ChildInfo]
}
struct FolderInfo: Codable {
    var id: String
    var name: String
    var cost: Double
    var requests: Int
    var chats: [ChatInfo]
}
struct SourceOfTruth: Codable {
    var updated: String
    var country: String
    var credit: CreditInfo?
    var today: TodayInfo
    var folders: [FolderInfo]
    /// True when the trace log was missing and each chat's share was split from
    /// the day's exact spend by token count instead of per-request prices.
    var approximate: Bool?
}

enum CollectorState: String { case ok, blockedNoVPN }

struct RefreshResult {
    var truth: SourceOfTruth?
    var state: CollectorState
    var creditAt: Date?
}

// MARK: - Paths

enum CUPaths {
    static let home = FileManager.default.homeDirectoryForCurrentUser
    static let support = home.appendingPathComponent("Library/Application Support/ClaudeUsage", isDirectory: true)
    static let generations = support.appendingPathComponent("generations.jsonl")
    static let state = support.appendingPathComponent("collector-state.json")
    static let truth = support.appendingPathComponent("source-of-truth.json")
    /// The trace log moved when project 216 was migrated into 136 on 18 Nov,
    /// and the old proxy still writes to a deleted inode. Try both, newest wins.
    static let traceCandidates = [
        home.appendingPathComponent(
            "1-MY-WORK/136th-day-fix-rtl-claude/abzar/216-migration/.runtime/live-request-trace/requests.jsonl"),
        home.appendingPathComponent(
            "1-MY-WORK/216th-day-migration-to-open-source-model/.runtime/live-request-trace/requests.jsonl"),
    ]
    /// The candidate with the most recent modification time, or the first one
    /// (so its parent folder gets created) when none exists yet.
    static var trace: URL {
        let fm = FileManager.default
        var best: (URL, Date)?
        for u in traceCandidates {
            guard let a = try? fm.attributesOfItem(atPath: u.path),
                  let d = a[.modificationDate] as? Date else { continue }
            if best == nil || d > best!.1 { best = (u, d) }
        }
        return best?.0 ?? traceCandidates[0]
    }
    static let work = home.appendingPathComponent("1-MY-WORK", isDirectory: true)
    static let projects = home.appendingPathComponent(".claude/projects", isDirectory: true)

    static func writeAtomic(_ data: Data, to url: URL) {
        let fm = FileManager.default
        try? fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let tmp = url.deletingLastPathComponent().appendingPathComponent(url.lastPathComponent + ".tmp")
        guard (try? data.write(to: tmp)) != nil else { return }
        if fm.fileExists(atPath: url.path) {
            _ = try? fm.replaceItemAt(url, withItemAt: tmp)
        } else {
            try? fm.moveItem(at: tmp, to: url)
        }
    }
}

// MARK: - Transcript index for chat attribution

struct TranscriptEntry {
    let ts: TimeInterval
    let chat: String
    let sidechain: Bool
    /// input + output + cache read + cache write, for the token-share fallback
    /// used when the trace log is missing.
    var tokens: Int = 0
}

struct IndexedFile {
    private(set) var offset: UInt64 = 0
    var entries: [TranscriptEntry] = []
    var customTitle = ""
    var aiTitle = ""

    // Only these three record kinds matter; checking the raw bytes first avoids
    // JSON-parsing the ~1000x more numerous message/queue lines.
    private static let assistantMark = Data(#""type":"assistant""#.utf8)
    private static let customMark = Data(#""type":"custom-title""#.utf8)
    private static let aiMark = Data(#""type":"ai-title""#.utf8)

    mutating func read(path: String, size: Int, chat: String) {
        if size < Int(offset) { self = IndexedFile() }   // rewritten: read from the top
        guard size > Int(offset), let fh = FileHandle(forReadingAtPath: path) else { return }
        defer { try? fh.close() }
        try? fh.seek(toOffset: offset)
        var consumed = offset
        var leftover = Data()
        do {
            while true {
                guard let chunk = try fh.read(upToCount: 4 << 20), !chunk.isEmpty else { break }
                var data = leftover
                data.append(chunk)
                let base = consumed - UInt64(leftover.count)   // absolute offset of `data[0]`
                var idx = data.startIndex
                var lastNL: Data.Index?
                while let nl = data[idx...].firstIndex(of: 0x0A) {
                    parse(data[idx..<nl], chat: chat)
                    lastNL = nl
                    idx = data.index(after: nl)
                }
                if let nl = lastNL {
                    consumed = base + UInt64(data.distance(from: data.startIndex, to: nl) + 1)
                    leftover = Data(data[idx...])
                } else {
                    leftover = data
                }
            }
        } catch { }
        offset = consumed
    }

    private mutating func parse(_ line: Data, chat: String) {
        if line.range(of: Self.aiMark) != nil || line.range(of: Self.customMark) != nil {
            guard let e = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { return }
            if (e["type"] as? String) == "custom-title",
               let t = e["customTitle"] as? String, !t.isEmpty { customTitle = t }
            if (e["type"] as? String) == "ai-title",
               let t = e["aiTitle"] as? String, !t.isEmpty { aiTitle = t }
            return
        }
        guard line.range(of: Self.assistantMark) != nil,
              let e = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
              (e["type"] as? String) == "assistant",
              let s = e["timestamp"] as? String,
              let d = ORTime.date(s) else { return }
        // `<synthetic>` records are CLI bookkeeping, never an API call.
        if let m = (e["message"] as? [String: Any])?["model"] as? String, m == "<synthetic>" { return }
        let u = (e["message"] as? [String: Any])?["usage"] as? [String: Any] ?? [:]
        func n(_ k: String) -> Int { (u[k] as? NSNumber)?.intValue ?? 0 }
        let tokens = n("input_tokens") + n("output_tokens")
            + n("cache_read_input_tokens") + n("cache_creation_input_tokens")
        entries.append(TranscriptEntry(ts: d.timeIntervalSince1970, chat: chat,
                                       sidechain: (e["isSidechain"] as? Bool) ?? false,
                                       tokens: tokens))
    }
}

/// «حدس» (mods/hads) forks the chat itself, so its calls never reach the
/// transcript and the trace cannot see them. It does keep its own per-session
/// usage log (`~/.claude/hads-log/<sid>.usage.jsonl`), which is the only place
/// the extra cost can be separated out. Priced at the model's list price.
enum HadsLog {
    static let dir = CUPaths.home.appendingPathComponent(".claude/hads-log")
    static let pIn = 36e-9, pOut = 500e-9, pCr = 10e-9, pCw = 36e-9

    /// Session id → (cost, calls) for calls at or after `since`.
    static func load(since: TimeInterval) -> [String: (cost: Double, calls: Int)] {
        var out: [String: (cost: Double, calls: Int)] = [:]
        let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
        for name in names where name.hasSuffix(".usage.jsonl") {
            let sid = String(name.prefix { $0 != "." })
            guard let text = try? String(contentsOf: dir.appendingPathComponent(name), encoding: .utf8)
            else { continue }
            var cost = 0.0, calls = 0
            for line in text.split(whereSeparator: \.isNewline) {
                guard let d = line.data(using: .utf8),
                      let e = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                      let t = (e["t"] as? NSNumber)?.doubleValue, t / 1000 >= since,
                      let u = e["usage"] as? [String: Any] else { continue }
                func n(_ k: String) -> Double { (u[k] as? NSNumber)?.doubleValue ?? 0 }
                cost += n("input_tokens") * pIn + n("output_tokens") * pOut
                    + n("cache_read_input_tokens") * pCr + n("cache_creation_input_tokens") * pCw
                calls += 1
            }
            if calls > 0 { out[sid] = (cost, calls) }
        }
        return out
    }
}

/// remember writes `<project>/.remember/logs/memory-YYYY-MM-DD.log` and logs
/// `HH:MM:SS [part] tokens: IN+NNNcache->OUTout ($x)` per call. The dollar
/// figure in that line is priced for Anthropic's models — 100x too high for
/// DeepSeek — so only the token counts are used here and priced with the real
/// model price. There is no session id, so the folder is exact and the chat is
/// guessed from the timestamp.
enum RememberLog {
    static let pIn = 36e-9, pOut = 500e-9, pCr = 10e-9
    private static let timeFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    /// folder name → [(timestamp, cost)] for the given UTC day.
    static func load(dayStart: TimeInterval) -> [String: [(ts: TimeInterval, cost: Double)]] {
        var out: [String: [(ts: TimeInterval, cost: Double)]] = [:]
        let day = ORTime.utcDay(Date(timeIntervalSince1970: dayStart))
        var roots = [CUPaths.work]
        roots.append(CUPaths.home.appendingPathComponent(".remember/logs"))
        var files: [(String, URL)] = []
        for name in (try? FileManager.default.contentsOfDirectory(atPath: CUPaths.work.path)) ?? [] {
            let f = CUPaths.work.appendingPathComponent(name)
                .appendingPathComponent(".remember/logs/memory-\(day).log")
            if FileManager.default.fileExists(atPath: f.path) { files.append((name, f)) }
        }
        // The global `~/.remember/logs` file is legacy: it carries no project,
        // so it cannot be attributed and is left out rather than unbalancing
        // the day's total.
        _ = roots

        var base = Calendar.current.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: dayStart))
        base.timeZone = TimeZone.current
        for (folder, url) in files {
            guard let text = try? String(contentsOf: url, encoding: .utf8) else { continue }
            var rows: [(TimeInterval, Double)] = []
            for line in text.split(whereSeparator: \.isNewline) {
                guard let r = line.range(of: "tokens: ") else { continue }
                let rest = line[r.upperBound...]
                // `15383+0cache->403out`
                let parts = rest.split(separator: " ")
                guard let head = parts.first else { continue }
                let nums = head.split(whereSeparator: { "+-<>cacheout".contains($0) }).compactMap { Int($0) }
                guard nums.count >= 3 else { continue }
                let cost = Double(nums[0]) * pIn + Double(nums[1]) * pCr + Double(nums[2]) * pOut
                var comps = base
                if let t = line.split(separator: " ").first,
                   let d = timeFmt.date(from: String(t)) {
                    let c = Calendar.current.dateComponents([.hour, .minute, .second], from: d)
                    comps.hour = c.hour; comps.minute = c.minute; comps.second = c.second
                }
                let ts = Calendar.current.date(from: comps)?.timeIntervalSince1970 ?? dayStart
                rows.append((ts, cost))
            }
            if !rows.isEmpty {
                var list = out[folder] ?? []
                list.append(contentsOf: rows)
                out[folder] = list
            }
        }
        return out
    }
}

struct FolderIndex {
    var files: [String: IndexedFile] = [:]
    private(set) var sorted: [TranscriptEntry] = []
    private(set) var titles: [String: String] = [:]
    /// Token totals since `since`, per chat and per subagent, so the fallback
    /// can split the day's exact spend in proportion to work done.
    private(set) var tokensByChat: [String: Int] = [:]
    private(set) var tokensBySide: [String: Int] = [:]
    private(set) var lastByChat: [String: TimeInterval] = [:]
    private(set) var messagesByChat: [String: Int] = [:]
    /// `since` limits which files are opened; `dayStart` limits which entries
    /// count, so the day's spend is split by today's tokens only.
    private var since: TimeInterval = 0
    private var dayStart: TimeInterval = 0

    mutating func refresh(dir: URL, since: TimeInterval, dayStart: TimeInterval) {
        self.since = since
        self.dayStart = dayStart
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: dir.path) else { finish(); return }
        let live = Set(names.filter { $0.hasSuffix(".jsonl") })
        files = files.filter { live.contains($0.key) }
        for name in live {
            let path = dir.appendingPathComponent(name).path
            var st = stat()
            guard stat(path, &st) == 0 else { continue }
            let mtime = Double(st.st_mtimespec.tv_sec) + Double(st.st_mtimespec.tv_nsec) / 1e9
            // A file last written before the oldest request cannot hold its message.
            if mtime < since { continue }
            var f = files[name] ?? IndexedFile()
            f.read(path: path, size: Int(st.st_size), chat: (name as NSString).deletingPathExtension)
            files[name] = f
        }
        finish()
    }

    private mutating func finish() {
        sorted = files.values.flatMap { $0.entries }.sorted { $0.ts < $1.ts }
        tokensByChat = [:]
        tokensBySide = [:]
        lastByChat = [:]
        messagesByChat = [:]
        for e in sorted where e.ts >= dayStart {
            tokensByChat[e.chat, default: 0] += e.tokens
            if e.sidechain { tokensBySide[e.chat, default: 0] += e.tokens }
            lastByChat[e.chat] = max(lastByChat[e.chat] ?? 0, e.ts)
            messagesByChat[e.chat, default: 0] += 1
        }
        var t: [String: String] = [:]
        for (name, f) in files {
            let id = (name as NSString).deletingPathExtension
            t[id] = !f.customTitle.isEmpty ? f.customTitle : (!f.aiTitle.isEmpty ? f.aiTitle : String(id.prefix(8)))
        }
        titles = t
    }

    /// Nearest assistant message within ±15 s; binary search because the index is sorted.
    func nearest(to ts: TimeInterval) -> TranscriptEntry? {
        guard !sorted.isEmpty else { return nil }
        var lo = 0, hi = sorted.count
        while lo < hi {
            let mid = (lo + hi) / 2
            if sorted[mid].ts < ts { lo = mid + 1 } else { hi = mid }
        }
        var best: TranscriptEntry?
        for i in [lo - 1, lo, lo + 1] where sorted.indices.contains(i) {
            let e = sorted[i]
            if best == nil || abs(e.ts - ts) < abs(best!.ts - ts) { best = e }
        }
        guard let b = best, abs(b.ts - ts) <= 15 else { return nil }
        return b
    }
}

// MARK: - Collector

/// Owns the trace offset, the price file, the transcript index and the snapshot.
/// An actor, so a 60 s credit pass and a 20 s collector pass can never write the
/// same state at once.
actor UsageCollector {
    private var vpn = VPNProbe()
    private var country: String?
    private var lastCreditAt: Date?

    private var priced: [String: Priced]
    /// Read but not priced yet (404 / network): kept so the next pass retries it.
    private var pending: [String: TraceRecord] = [:]
    private var offset: UInt64
    private var indexes: [String: FolderIndex] = [:]
    private var folderNames: [String: String] = [:]
    private var current: SourceOfTruth?

    init() {
        priced = Self.loadPrices()
        offset = Self.loadOffset()
    }

    // MARK: state files

    private static func loadPrices() -> [String: Priced] {
        guard let text = try? String(contentsOf: CUPaths.generations, encoding: .utf8) else { return [:] }
        var out: [String: Priced] = [:]
        for line in text.split(whereSeparator: \.isNewline) {
            guard let d = line.data(using: .utf8),
                  let p = try? JSONDecoder().decode(Priced.self, from: d) else { continue }
            out[p.id] = p     // a later line wins
        }
        return out
    }

    private static func loadOffset() -> UInt64 {
        guard let d = try? Data(contentsOf: CUPaths.state),
              let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              // A different file now: the old byte offset means nothing.
              (j["path"] as? String) == CUPaths.trace.path,
              let n = j["offset"] as? NSNumber else { return 0 }
        return n.uint64Value
    }

    private func saveOffset() {
        // `path` is stored so a switched trace file never inherits an offset
        // that belongs to a different file.
        let obj: [String: Any] = ["offset": offset, "path": CUPaths.trace.path]
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
        CUPaths.writeAtomic(data, to: CUPaths.state)
    }

    private func store(_ p: Priced) {
        guard priced[p.id] == nil else { return }
        priced[p.id] = p
        let enc = JSONEncoder()
        enc.outputFormatting = [.withoutEscapingSlashes]
        guard var d = try? enc.encode(p) else { return }
        d.append(0x0A)
        try? FileManager.default.createDirectory(at: CUPaths.support, withIntermediateDirectories: true)
        if let h = try? FileHandle(forWritingTo: CUPaths.generations) {
            _ = try? h.seekToEnd()
            try? h.write(contentsOf: d)
            try? h.close()
        } else {
            try? d.write(to: CUPaths.generations)
        }
    }

    // MARK: VPN

    private func countryChecked() async -> Bool {
        country = await vpn.country()
        let blocked = (country == "IR")
        if blocked { FetchLog.write("openrouter: loc=IR — no OpenRouter calls") }
        return !blocked
    }

    // MARK: credit + today

    func refreshCredit() async -> RefreshResult {
        guard await countryChecked() else {
            return RefreshResult(truth: current, state: .blockedNoVPN, creditAt: lastCreditAt)
        }
        let apiKey = ORKeys.value("OPENROUTER_API_KEY")
        var credit: CreditInfo? = current?.credit
        var today = current?.today ?? TodayInfo(spend: 0, requests: 0)

        if let apiKey {
            do {
                let c = try await ORClient.credits(apiKey)
                credit = CreditInfo(total: c.total, used: c.used, remaining: c.remaining)
                lastCreditAt = Date()
            } catch {
                FetchLog.write("openrouter: credits \(error)")
            }

            let day = ORTime.utcDay()
            var daySpend: DaySpend?
            if let mgmt = ORKeys.value("OPENROUTER_MANAGEMENT_KEY") {
                do { daySpend = try await ORClient.activityToday(mgmt, day: day) }
                catch { FetchLog.write("openrouter: activity \(error)") }
            }
            // `/activity` only carries finalized days; before its first row for
            // today, `/key`'s usage_daily is the only live figure.
            if daySpend?.found != true {
                do { daySpend = DaySpend(spend: try await ORClient.usageDaily(apiKey),
                                         requests: Self.traceCountToday(day: day), found: true) }
                catch { FetchLog.write("openrouter: key \(error)") }
            }
            if let d = daySpend {
                // In approximate mode `publish()` counts the assistant messages
                // written today; the trace count here is 0 and would wipe it.
                let keep = current?.approximate == true ? (current?.today.requests ?? 0) : d.requests
                today = TodayInfo(spend: d.spend, requests: max(d.requests, keep))
            }
        } else {
            FetchLog.write("openrouter: OPENROUTER_API_KEY not found")
        }

        current = SourceOfTruth(updated: ORTime.string(Date()),
                                country: country ?? "",
                                credit: credit,
                                today: today,
                                folders: current?.folders ?? [],
                                approximate: current?.approximate)
        writeTruth()
        return RefreshResult(truth: current, state: .ok, creditAt: lastCreditAt)
    }

    private static func traceCountToday(day: String) -> Int {
        guard let text = try? String(contentsOf: CUPaths.trace, encoding: .utf8) else { return 0 }
        var n = 0
        for line in text.split(whereSeparator: \.isNewline) {
            guard line.hasPrefix("{\"time_utc\": \"\(day)") || line.contains("\"time_utc\": \"\(day)") else { continue }
            n += 1
        }
        return n
    }

    // MARK: collector pass

    func collect() async -> RefreshResult {
        guard await countryChecked() else {
            return RefreshResult(truth: current, state: .blockedNoVPN, creditAt: lastCreditAt)
        }
        let records = readNewTrace()
        // Only today's requests are priced: the panel shows today, and pricing
        // the whole 5k-line history on first launch took minutes of API calls.
        let todayStart = ORTime.utcDayStart()
        for r in records where r.status == 200 && !r.responseID.isEmpty
            && r.time >= todayStart && priced[r.responseID] == nil {
            pending[r.responseID] = r
        }
        let queue = pending.values.sorted { $0.time < $1.time }

        if !queue.isEmpty, let key = ORKeys.value("OPENROUTER_API_KEY") {
            var done = 0
            for chunk in queue.chunked(4) {
                if Task.isCancelled { break }
                let got = await withTaskGroup(of: Priced?.self, returning: [Priced].self) { group -> [Priced] in
                    for (i, rec) in chunk.enumerated() {
                        // Starts are spaced >=100 ms apart and a group waits for all
                        // four before the next, so never more than 4 run at once.
                        if i > 0 { try? await Task.sleep(nanoseconds: 100_000_000) }
                        group.addTask { await Self.price(rec, key: key) }
                    }
                    var out: [Priced] = []
                    for await p in group { if let p { out.append(p) } }
                    return out
                }
                for p in got { store(p); pending.removeValue(forKey: p.id) }
                done += chunk.count
                // Fill the menu while a long first pricing run is still going.
                if done % 200 < 4 { _ = publish() }
            }
        }

        // The offset only moves once everything read so far is priced; a pass
        // that left 404s behind keeps the old offset, so a restart retries them.
        if pending.isEmpty { saveOffset() }
        return RefreshResult(truth: publish(), state: .ok, creditAt: lastCreditAt)
    }

    private static func price(_ rec: TraceRecord, key: String) async -> Priced? {
        do {
            guard let g = try await ORClient.generation(id: rec.responseID, key: key) else {
                return nil   // 404: retried next pass, never cached as a price
            }
            return Priced(id: rec.responseID, cost: g.cost, ts: rec.time, project: rec.project,
                          model: g.model, provider: g.provider, prompt: g.prompt,
                          cached: g.cached, completion: g.completion)
        } catch {
            FetchLog.write("openrouter: generation \(rec.responseID) \(error)")
            return nil
        }
    }

    private func readNewTrace() -> [TraceRecord] {
        guard let fh = FileHandle(forReadingAtPath: CUPaths.trace.path) else { return [] }
        defer { try? fh.close() }
        let size = (try? fh.seekToEnd()) ?? 0
        if size < offset { offset = 0 }          // truncated: start over
        guard size > offset else { return [] }
        do {
            try fh.seek(toOffset: offset)
            guard let data = try fh.read(upToCount: Int(size - offset)), !data.isEmpty else { return [] }
            // Only whole lines: a line still being written is read next time.
            guard let lastNL = data.lastIndex(of: 0x0A) else { return [] }
            offset += UInt64(data.distance(from: data.startIndex, to: lastNL) + 1)
            var out: [TraceRecord] = []
            for line in data[data.startIndex...lastNL].split(separator: 0x0A, omittingEmptySubsequences: true) {
                if let r = Self.parseTrace(Data(line)) { out.append(r) }
            }
            return out
        } catch {
            FetchLog.write("openrouter: trace read \(error)")
            return []
        }
    }

    private static func parseTrace(_ d: Data) -> TraceRecord? {
        guard let e = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let s = e["time_utc"] as? String, let date = ORTime.date(s) else { return nil }
        var project = (e["project"] as? String) ?? "unknown"
        if project.isEmpty { project = "unknown" }
        let status = (e["status"] as? NSNumber)?.intValue
        return TraceRecord(time: date.timeIntervalSince1970, project: project,
                           status: status, responseID: (e["response_id"] as? String) ?? "")
    }

    // MARK: attribution + snapshot

    private func folderName(for id: String) -> String {
        if let n = folderNames[id] { return n }
        let names = (try? FileManager.default.contentsOfDirectory(atPath: CUPaths.work.path)) ?? []
        // `136th-…`; `the` covers the one folder named `108the-…`.
        let hit = names.first { $0.hasPrefix(id + "th-") || $0.hasPrefix(id + "the-") }
        let name = hit ?? id
        folderNames[id] = name
        return name
    }

    /// `136th-day-…` → `136`; nil for any folder that is not a numbered project.
    private static func projectID(_ folder: String) -> String? {
        let digits = folder.prefix { $0.isNumber }
        return digits.isEmpty ? nil : String(digits)
    }

    /// Projects with a transcript written since `since` — the fallback has no
    /// trace log to tell it which folders were busy today.
    private func activeProjects(since: TimeInterval) -> Set<String> {
        var out = Set<String>()
        let names = (try? FileManager.default.contentsOfDirectory(atPath: CUPaths.work.path)) ?? []
        for name in names {
            guard let id = Self.projectID(name) else { continue }
            let dir = transcriptDir(folder: name)
            for f in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
            where f.hasSuffix(".jsonl") {
                var st = stat()
                guard stat(dir.appendingPathComponent(f).path, &st) == 0 else { continue }
                let m = Double(st.st_mtimespec.tv_sec) + Double(st.st_mtimespec.tv_nsec) / 1e9
                if m >= since { out.insert(id); break }
            }
        }
        return out
    }

    private func transcriptDir(folder: String) -> URL {
        let flat = (CUPaths.home.path + "/1-MY-WORK/" + folder).replacingOccurrences(of: "/", with: "-")
        return CUPaths.projects.appendingPathComponent(flat)
    }

    private func index(for project: String, folder: String, since: TimeInterval,
                       dayStart: TimeInterval) -> FolderIndex {
        var idx = indexes[project] ?? FolderIndex()
        idx.refresh(dir: transcriptDir(folder: folder), since: since, dayStart: dayStart)
        indexes[project] = idx
        return idx
    }

    private func publish() -> SourceOfTruth {
        let now = Date()
        let nowTs = now.timeIntervalSince1970
        // generations.jsonl keeps every day; the panel is "today", so the
        // aggregation must not carry yesterday's prices forward.
        let todayStart = ORTime.utcDayStart(now)
        let values = priced.values.filter { $0.ts >= todayStart }
        // With no priced request the trace is missing or off; fall back to
        // splitting the day's exact spend by tokens read from the transcripts.
        let approximate = values.isEmpty
        let oldest = values.map(\.ts).min() ?? nowTs
        let since = min(oldest, todayStart) - 86400

        var projects = Set(values.map(\.project))
        if approximate { projects.formUnion(activeProjects(since: todayStart)) }
        var folderIdx: [String: FolderIndex] = [:]
        for p in projects {
            folderIdx[p] = index(for: p, folder: folderName(for: p),
                                 since: since, dayStart: todayStart)
        }

        struct ChatAgg {
            var id: String; var title: String; var cost = 0.0; var count = 0
            var last: TimeInterval = 0; var subCost = 0.0; var subCount = 0
            var hadsCost = 0.0; var hadsCount = 0
            var remCost = 0.0; var remCount = 0
        }
        struct FolderAgg {
            var id: String; var name: String; var cost = 0.0; var requests = 0
            var chats: [String: ChatAgg] = [:]
            var extCost = 0.0; var extCount = 0; var extLast: TimeInterval = 0
        }

        var agg: [String: FolderAgg] = [:]
        for p in values {
            var f = agg[p.project] ?? FolderAgg(id: p.project, name: folderName(for: p.project))
            f.cost += p.cost
            f.requests += 1
            if let e = folderIdx[p.project]?.nearest(to: p.ts) {
                let title = folderIdx[p.project]?.titles[e.chat] ?? String(e.chat.prefix(8))
                var c = f.chats[e.chat] ?? ChatAgg(id: e.chat, title: title)
                c.cost += p.cost
                c.count += 1
                c.last = max(c.last, p.ts)
                if e.sidechain { c.subCost += p.cost; c.subCount += 1 }
                f.chats[e.chat] = c
            } else {
                // Title generation, hads, remember …: no assistant message of ours.
                f.extCost += p.cost
                f.extCount += 1
                f.extLast = max(f.extLast, p.ts)
            }
            agg[p.project] = f
        }

        // Fallback: no per-request prices today, so split the day's spend by
        // each chat's share of the tokens actually written today.
        if approximate {
            let spend = current?.today.spend ?? 0
            // «حدس» is priced from its own log and taken out of the budget
            // first; the rest is split by the tokens the transcripts recorded.
            let hads = HadsLog.load(since: todayStart)
            let hadsTotal = hads.values.reduce(0) { $0 + $1.cost }
            let remember = RememberLog.load(dayStart: todayStart)
            let rememberTotal = remember.values.reduce(0) { $0 + $1.reduce(0) { $0 + $1.cost } }
            let budget = max(0, spend - hadsTotal - rememberTotal)
            let total = folderIdx.values.reduce(0) { $0 + $1.tokensByChat.values.reduce(0, +) }
            if total > 0 {
                for (proj, idx) in folderIdx {
                    let projTokens = idx.tokensByChat.values.reduce(0, +)
                    guard projTokens > 0 else { continue }
                    var f = FolderAgg(id: proj, name: folderName(for: proj))
                    f.cost = budget * Double(projTokens) / Double(total)
                    for (chat, tk) in idx.tokensByChat {
                        var c = ChatAgg(id: chat, title: idx.titles[chat] ?? String(chat.prefix(8)))
                        c.cost = budget * Double(tk) / Double(total)
                        c.last = idx.lastByChat[chat] ?? 0
                        c.count = idx.messagesByChat[chat] ?? 0
                        let side = idx.tokensBySide[chat] ?? 0
                        if side > 0, tk > 0 {
                            c.subCost = c.cost * Double(side) / Double(tk)
                            c.subCount = 0
                        }
                        if let h = hads[chat] {
                            c.hadsCost = h.cost
                            c.hadsCount = h.calls
                            c.cost += h.cost
                            f.cost += h.cost
                        }
                        f.chats[chat] = c
                    }
                    // remember's log has no session id: attach each call to the
                    // chat that was writing around that moment, else the most
                    // recent one before it.
                    for (ts, cost) in remember[f.name] ?? [] {
                        let chat = idx.nearest(to: ts)?.chat
                            ?? idx.lastByChat.filter { $0.value <= ts + 120 }.max { $0.value < $1.value }?.key
                        guard let chat, var c = f.chats[chat] else { continue }
                        c.remCost += cost
                        c.remCount += 1
                        c.cost += cost
                        f.chats[chat] = c
                        f.cost += cost
                    }
                    agg[proj] = f
                }
            }
        }

        func chatInfo(_ c: ChatAgg) -> ChatInfo {
            var children: [ChildInfo] = []
            if c.subCost > 0 {
                children.append(ChildInfo(kind: "subagent", label: "Subagents", cost: c.subCost, count: c.subCount))
            }
            if c.hadsCost > 0 {
                children.append(ChildInfo(kind: "hads", label: "Hads", cost: c.hadsCost, count: c.hadsCount))
            }
            if c.remCost > 0 {
                children.append(ChildInfo(kind: "remember", label: "Remember", cost: c.remCost, count: c.remCount))
            }
            return ChatInfo(id: c.id, title: c.title, cost: c.cost,
                            last: ORTime.string(Date(timeIntervalSince1970: c.last)),
                            live: nowTs - c.last < 180, children: children)
        }

        var folders: [FolderInfo] = []
        for f in agg.values {
            var chats = f.chats.values.map(chatInfo)
            if f.extCount > 0 {
                chats.append(ChatInfo(id: "extensions", title: "Extensions", cost: f.extCost,
                                      last: ORTime.string(Date(timeIntervalSince1970: f.extLast)),
                                      live: nowTs - f.extLast < 180, children: []))
            }
            chats.sort { $0.last > $1.last }
            folders.append(FolderInfo(id: f.id, name: f.name, cost: f.cost, requests: f.requests, chats: chats))
        }
        folders.sort { $0.cost > $1.cost }

        var today = current?.today ?? TodayInfo(spend: 0, requests: 0)
        if approximate {
            // No trace log: model calls are not counted, so show the number of
            // assistant messages written today — what the panel can prove.
            today.requests = folderIdx.values.reduce(0) { $0 + $1.messagesByChat.values.reduce(0, +) }
        }
        current = SourceOfTruth(updated: ORTime.string(now), country: country ?? "",
                                credit: current?.credit,
                                today: today,
                                folders: folders, approximate: approximate)
        writeTruth()
        return current!
    }

    private func writeTruth() {
        guard let t = current else { return }
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard let d = try? enc.encode(t) else { return }
        CUPaths.writeAtomic(d, to: CUPaths.truth)
    }
}

extension Array {
    func chunked(_ n: Int) -> [[Element]] {
        guard n > 0, !isEmpty else { return [] }
        return stride(from: 0, to: count, by: n).map {
            Array(self[$0..<Swift.min($0 + n, count)])
        }
    }
}

// MARK: - Log

/// Kept from the old usage engine, which was deleted on 18 Nov: Alarms.swift
/// still records every delivered notification here.
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
