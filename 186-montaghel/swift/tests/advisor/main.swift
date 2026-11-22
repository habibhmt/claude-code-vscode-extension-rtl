import Foundation

var cal = Calendar(identifier: .gregorian)
cal.timeZone = TimeZone(identifier: "Asia/Tehran")!
func at(_ s: String) -> Date {   // "2026-10-15 14:00" Tehran
    let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone
    f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)!
}
var fails = 0
func check(_ name: String, _ ok: Bool) { print((ok ? "PASS " : "FAIL ") + name); if !ok { fails += 1 } }

// OpenRouter timestamps: transcripts use milliseconds, the trace microseconds.
check("O1 ISO milliseconds", ORTime.date("2026-11-18T03:42:28.117Z") != nil)
check("O2 ISO microseconds", ORTime.date("2026-11-18T03:42:28.117537+00:00") != nil)
check("O3 ISO without fractions", ORTime.date("2026-11-18T03:42:28Z") != nil)
check("O4 bad date → nil", ORTime.date("not-a-date") == nil)
let day = Date(timeIntervalSince1970: 1_800_000_000)
let range = ORTime.tehranDayRange(day)
check("O5 Tehran day is two UTC bounds", range.0 != range.1 && range.0.hasSuffix("Z") && range.1.hasSuffix("Z"))
check("O6 UTC day is yyyy-MM-dd", ORTime.utcDay(day).count == 10)
check("O7 empty spend defaults", DaySpend().spend == 0 && DaySpend().requests == 0 && !DaySpend().found)

// Transcript: only appended lines are read, and the result equals a full read.
do {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("tr-\(getpid())")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let f = dir.appendingPathComponent("c.jsonl").path
    let nowT = Date()
    func ans(_ secAgo: Double, _ out: Int, _ model: String = "claude-opus-5-5") -> String {
        let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return #"{"type":"assistant","timestamp":"\#(iso.string(from: nowT.addingTimeInterval(-secAgo)))","message":{"model":"\#(model)","stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":\#(out)}}}"# + "\n"
    }
    FileManager.default.createFile(atPath: f, contents: Data((ans(60, 100)).utf8))
    var t = Transcript(); t.update(path: f, now: nowT)
    let first = t.offset
    check("T1 first read counts the answer", t.totals(now: nowT).w5 == 5 * (10 + 500))
    // append one whole line and half of the next
    let h = FileHandle(forWritingAtPath: f)!; h.seekToEndOfFile()
    let next = ans(30, 200, "claude-fable-5-1")
    h.write(Data((next + String(ans(10, 300).prefix(40))).utf8))
    t.update(path: f, now: nowT)
    check("T2 only the new whole line is read; half a line waits", t.offset == first + UInt64(next.utf8.count)
          && t.totals(now: nowT).w5 == 5 * 510 + 5 * 1010 && t.model == "claude-fable-5-1")
    check("T3 fable share counted", t.totals(now: nowT).f7 == 5 * 1010)
    var full = Transcript(); full.update(path: f, now: nowT)
    check("T4 piecewise read == full read", full.totals(now: nowT) == t.totals(now: nowT) && full.offset == t.offset)
    // rewritten (shorter) file is read again from scratch
    FileManager.default.createFile(atPath: f, contents: Data(ans(5, 1).utf8))
    t.update(path: f, now: nowT)
    check("T5 shrunk file → re-read from scratch", t.totals(now: nowT).w7 == 5 * 15)
    // 6 h later the 5 h window has slid without a re-read
    check("T6 5 h window slides with time", t.totals(now: nowT.addingTimeInterval(6 * 3600)).w5 == 0)
    try? FileManager.default.removeItem(at: dir)
}

// 03 zang-e cache: the marks, the hour limit and the text.
check("C1 29 min → no ring", Rules.cacheMark(elapsed: 29 * 60) == nil)
check("C2 30 min → 30", Rules.cacheMark(elapsed: 30 * 60) == 30)
check("C3 47 min → 45", Rules.cacheMark(elapsed: 47 * 60) == 45)
check("C4 59 min → 55", Rules.cacheMark(elapsed: 59 * 60) == 55)
check("C5 60 min → too late, nothing", Rules.cacheMark(elapsed: 60 * 60) == nil)
check("C6 test unit: 45 «minutes» of 2 s → 45", Rules.cacheMark(elapsed: 90, unit: 2) == 45)
let ct = Rules.cacheText(mark: 45, ctxText: "102,000")
check("C7 «۴۵ دقیقه — ۱۵ دقیقه وقت داری» + «حجم: ۱۰۲٬۰۰۰ توکن»",
      ct.title.contains("۴۵ دقیقه — ۱۵ دقیقه وقت داری") && ct.body.contains("حجم: ۱۰۲٬۰۰۰ توکن"))

// 02 «جواب آماده شد»: only a new answer rings, never the first scan.
check("R1 first scan after launch → silent", !Rules.finished(prev: nil, now: "a", firstScan: true))
check("R1b first scan, known chat → silent", !Rules.finished(prev: "a", now: "b", firstScan: true))
check("R2 chat seen for the first time → silent", !Rules.finished(prev: nil, now: "a", firstScan: false))
check("R3 same answer → silent", !Rules.finished(prev: "a", now: "a", firstScan: false))
check("R4 new answer → rings", Rules.finished(prev: "a", now: "b", firstScan: false))
let rt = Rules.finishedText(ctxTokens: 102_000, ctxText: "102,000", model: "opus-5-5")
check("R5 text: «جواب آماده شد» + «کانتکست ۱۰۲٬۰۰۰ توکن · opus-5-5», no 🔴",
      rt.title.hasSuffix("جواب آماده شد") && !rt.title.contains("🔴") && rt.body.contains("کانتکست ۱۰۲٬۰۰۰ توکن · opus-5-5"))
check("R6 over 150k → 🔴 and ⚠️", Rules.finishedText(ctxTokens: 160_000, ctxText: "160,000", model: "x").title.contains("🔴")
      && Rules.finishedText(ctxTokens: 160_000, ctxText: "160,000", model: "x").body.contains("⚠️"))


// 02 throttle: one banner per chat per hour, six banners an hour for all chats.
do {
    var g = Rules.ReplyGate(); let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    let v = (0..<10).map { g.verdict(chat: "a", now: t0.addingTimeInterval(Double($0) * 60)) }
    check("G1 10 answers of one chat in 10 min → 1 banner", v.filter { $0 == .banner }.count == 1 && v.filter { $0 == .skip }.count == 9)
    check("G2 same chat after an hour → rings again", g.verdict(chat: "a", now: t0.addingTimeInterval(3601)) == .banner)
    var g2 = Rules.ReplyGate()
    let w = (0..<10).map { g2.verdict(chat: "c\($0)", now: t0.addingTimeInterval(Double($0))) }
    check("G3 10 chats at once → 6 banners, 4 silent", w.filter { $0 == .banner }.count == 6 && w.filter { $0 == .silent }.count == 4)
    check("G4 an hour later the cap is free again", g2.verdict(chat: "z", now: t0.addingTimeInterval(3700)) == .banner)
}

// 02 «سقف فقط برای ایجنت‌ها»: his own turns always ring.
do {
    var g = Rules.ReplyGate(); let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    let v = (0..<10).map { g.verdict(chat: "h", fromHuman: true, now: t0.addingTimeInterval(Double($0) * 60)) }
    check("G5 10 answers to Habib in one chat → 10 banners", v.allSatisfy { $0 == .banner })
    var g2 = Rules.ReplyGate()
    for i in 0..<6 { _ = g2.verdict(chat: "a\(i)", now: t0) }
    check("G6 cap full of agent banners, Habib's answer still rings", g2.verdict(chat: "h", fromHuman: true, now: t0) == .banner
          && g2.verdict(chat: "a9", now: t0) == .silent)
    func rec(_ j: String) -> [String: Any] { (try? JSONSerialization.jsonObject(with: Data(j.utf8))) as? [String: Any] ?? [:] }
    var tr = Transcript()
    tr.feed(Data(#"{"type":"user","origin":{"kind":"peer"},"isMeta":true,"message":{"content":"Another Claude session sent a message"}}"#.utf8))
    let afterPeer = tr.turnFromHuman
    tr.feed(Data(#"{"type":"user","message":{"content":[{"type":"tool_result","content":"x"}]}}"#.utf8))
    let afterTool = tr.turnFromHuman
    tr.feed(Data(#"{"type":"user","isMeta":true,"message":{"content":"Base directory for this skill: /x"}}"#.utf8))
    let afterSkill = tr.turnFromHuman
    tr.feed(Data(#"{"type":"user","origin":{"kind":"human"},"message":{"content":"ادامه بده"}}"#.utf8))
    let afterHuman = tr.turnFromHuman
    tr.feed(Data(#"{"type":"user","origin":{"kind":"task-notification"},"message":{"content":"<task-notification>"}}"#.utf8))
    let afterTask = tr.turnFromHuman
    tr.feed(Data(#"{"type":"attachment","attachment":{"type":"queued_command","prompt":"کلا سبکشو خوشم نمیاد"}}"#.utf8))
    check("T7 peer ⇒ agent · tool_result keeps it · his message ⇒ human · task ⇒ agent",
          !afterPeer && !afterTool && afterHuman && !afterTask)
    check("T8 a skill's meta text after a peer message does not make the turn his", !afterSkill)
    check("T9 a message he typed mid-turn (queued_command) ⇒ human", tr.turnFromHuman)
    check("T11 queued peer message (origin on the attachment) ⇒ agent",
          Transcript.turnSource(rec(#"{"type":"attachment","attachment":{"type":"queued_command","commandMode":"prompt","origin":{"kind":"peer"},"prompt":"x"}}"#)) == false)
    check("T12 queued task notification without origin ⇒ agent",
          Transcript.turnSource(rec(#"{"type":"attachment","attachment":{"type":"queued_command","commandMode":"task-notification","prompt":"done"}}"#)) == false)
    check("T13 queued message he typed (origin human) ⇒ his",
          Transcript.turnSource(rec(#"{"type":"attachment","attachment":{"type":"queued_command","commandMode":"prompt","origin":{"kind":"human"},"prompt":"ادامه بده"}}"#)) == true)
    check("T10 old record without origin ⇒ his", Transcript.turnSource(rec(#"{"type":"user","message":{"content":"سلام"}}"#)) == true)
}

check("C8 cache chime: his chat → with sound, agent's chat → silent (still sent)",
      Rules.cacheLoud(fromHuman: true) && !Rules.cacheLoud(fromHuman: false))

// The two alarms end to end on a temp folder: first scan is silent, a new
// answer rings once, an old idle chat rings its cache mark, and a file older
// than 65 minutes is not even opened.
do {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("alarm-\(getpid())")
    let proj = dir.appendingPathComponent("-Users-x-1-MY-WORK-186-a")
    try? FileManager.default.createDirectory(at: proj, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: dir) }
    let iso = ISO8601DateFormatter()
    func ans(_ id: String, _ t: Date) -> String {
        #"{"type":"assistant","uuid":"\#(id)","timestamp":"\#(iso.string(from: t))","message":{"model":"claude-opus-5-5","stop_reason":"end_turn","usage":{"input_tokens":1000}}}"# + "\n"
    }
    let human = #"{"type":"user","origin":{"kind":"human"},"message":{"content":"سلام"}}"# + "\n"
    let now = Date()
    let live = proj.appendingPathComponent("live.jsonl")
    try? Data((human + ans("a1", now)).utf8).write(to: live)
    let idle = proj.appendingPathComponent("idle.jsonl")
    try? Data((human + ans("b1", now.addingTimeInterval(-31 * 60))).utf8).write(to: idle)
    let old = proj.appendingPathComponent("old.jsonl")
    try? Data((human + ans("c1", now)).utf8).write(to: old)
    try? FileManager.default.setAttributes([.modificationDate: now.addingTimeInterval(-70 * 60)], ofItemAtPath: old.path)
    let al = Alarms(root: dir)
    var got: [String] = []
    al.sink = { k, _ in got.append(k) }
    al.tick(now: now)
    check("A1 first scan after launch → nothing rings", got.isEmpty)
    check("A2 a file older than 65 min is not read", al.chats[old.path] == nil && al.chats.count == 2)
    let h = try! FileHandle(forWritingTo: live); h.seekToEndOfFile()
    h.write(Data((human + ans("a2", now)).utf8)); h.closeFile()
    try? FileManager.default.setAttributes([.modificationDate: now.addingTimeInterval(1)], ofItemAtPath: live.path)
    al.tick(now: now.addingTimeInterval(2))
    check("A3 new answer → «جواب آماده شد» with sound", got == ["reply-banner"])
    got = []
    al.tick(now: now.addingTimeInterval(14 * 60 + 10))
    check("A4 idle chat crosses 45 min → one chime", got == ["cache-45"])
    got = []
    al.tick(now: now.addingTimeInterval(14 * 60 + 15))
    check("A5 same mark never rings twice", got.isEmpty)
    got = []
    let bot = proj.appendingPathComponent("bot.jsonl")
    let title = #"{"type":"custom-title","customTitle":"۲۰۳-پیام رسان (خودکار)"}"# + "\n"
    try? Data((title + human + ans("d1", now.addingTimeInterval(-29 * 60))).utf8).write(to: bot)
    al.tick(now: now.addingTimeInterval(14 * 60 + 20))
    let h2 = try! FileHandle(forWritingTo: bot); h2.seekToEndOfFile()
    h2.write(Data((human + ans("d2", now.addingTimeInterval(15 * 60))).utf8)); h2.closeFile()
    try? FileManager.default.setAttributes([.modificationDate: now.addingTimeInterval(5)], ofItemAtPath: bot.path)
    al.tick(now: now.addingTimeInterval(16 * 60))
    check("A6 «(خودکار)» chat: new answer and cache mark → nothing", got.isEmpty)
    got = []
    // The name sits before the 3 MB tail the first read takes.
    let bigBot = proj.appendingPathComponent("bigbot.jsonl")
    let filler = String(repeating: #"{"type":"progress"}"# + "\n", count: 220_000)
    try? Data((title + filler + human + ans("e1", now.addingTimeInterval(15 * 60))).utf8).write(to: bigBot)
    try? FileManager.default.setAttributes([.modificationDate: now.addingTimeInterval(16 * 60)], ofItemAtPath: bigBot.path)
    al.tick(now: now.addingTimeInterval(16 * 60 + 2))
    let h3 = try! FileHandle(forWritingTo: bigBot); h3.seekToEndOfFile()
    h3.write(Data((human + ans("e2", now.addingTimeInterval(16 * 60))).utf8)); h3.closeFile()
    try? FileManager.default.setAttributes([.modificationDate: now.addingTimeInterval(17 * 60)], ofItemAtPath: bigBot.path)
    al.tick(now: now.addingTimeInterval(17 * 60 + 2))
    check("A7 big «(خودکار)» chat, name before the 3 MB tail → nothing", got.isEmpty)
}

// The trace carries only the project number ("91"), so subagent and workflow
// transcripts have to be indexed by time or their dollars land in "Extensions".
do {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("fi-\(getpid())")
    let proj = root.appendingPathComponent("proj")
    try? FileManager.default.createDirectory(at: proj, withIntermediateDirectories: true)
    let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let T = Date(timeIntervalSince1970: 1_800_000_000)
    func line(_ t: Date, _ out: Int) -> String {
        #"{"type":"assistant","timestamp":"\#(iso.string(from: t))","message":{"model":"m","usage":{"input_tokens":1,"output_tokens":\#(out)}}}"# + "\n"
    }
    let sid = "s1"
    try? Data(line(T, 10).utf8).write(to: proj.appendingPathComponent("\(sid).jsonl"))
    let sub = proj.appendingPathComponent(sid).appendingPathComponent("subagents")
    try? FileManager.default.createDirectory(at: sub, withIntermediateDirectories: true)
    try? Data(line(T.addingTimeInterval(5), 20).utf8).write(to: sub.appendingPathComponent("agent-a.jsonl"))
    let wf = sub.appendingPathComponent("workflows").appendingPathComponent("wf_x")
    try? FileManager.default.createDirectory(at: wf, withIntermediateDirectories: true)
    try? Data(line(T.addingTimeInterval(10), 30).utf8).write(to: wf.appendingPathComponent("agent-b.jsonl"))

    var idx = FolderIndex()
    idx.refresh(dir: proj, since: 0, dayStart: 0)
    check("K1 session transcript stays main", idx.nearest(to: T.timeIntervalSince1970)?.kind == .main)
    check("K2 subagent transcript ⇒ agent",
          idx.nearest(to: T.addingTimeInterval(5).timeIntervalSince1970)?.kind == .agent)
    check("K3 workflow transcript ⇒ workflow",
          idx.nearest(to: T.addingTimeInterval(10).timeIntervalSince1970)?.kind == .workflow)
    check("K4 chat tokens count the session file only",
          idx.tokensByChat.values.reduce(0, +) == 11)

    // Negative control: without the subagent folders the same moment is main.
    let bare = root.appendingPathComponent("bare")
    try? FileManager.default.createDirectory(at: bare, withIntermediateDirectories: true)
    try? Data(line(T.addingTimeInterval(5), 20).utf8).write(to: bare.appendingPathComponent("s2.jsonl"))
    var idx2 = FolderIndex()
    idx2.refresh(dir: bare, since: 0, dayStart: 0)
    check("K5 no subagent folders ⇒ main, not agent",
          idx2.nearest(to: T.addingTimeInterval(5).timeIntervalSince1970)?.kind == .main)

    // A slow first token: the answer starts far more than 15 s after the
    // request, but inside the request's own duration window (۲۱ نوامبر ۲۰۲۶).
    let slow = root.appendingPathComponent("slow")
    try? FileManager.default.createDirectory(at: slow, withIntermediateDirectories: true)
    try? Data(line(T.addingTimeInterval(20), 7).utf8)
        .write(to: slow.appendingPathComponent("s3.jsonl"))
    var idx3 = FolderIndex()
    idx3.refresh(dir: slow, since: 0, dayStart: 0)
    check("K6 answer at +20 s of a 30 s call ⇒ that chat, not background",
          idx3.nearest(to: T.timeIntervalSince1970, duration: 30)?.kind == .main)
    check("K7 same +20 s with a 5 s call ⇒ no match (negative control)",
          idx3.nearest(to: T.timeIntervalSince1970, duration: 5) == nil)

    // Compaction writes only a boundary, never an assistant line. The call that
    // summarises the chat must land on that chat, not in «پس‌زمینه».
    let comp = root.appendingPathComponent("comp")
    try? FileManager.default.createDirectory(at: comp, withIntermediateDirectories: true)
    let boundary = #"{"type":"system","subtype":"compact_boundary","timestamp":"\#(iso.string(from: T.addingTimeInterval(50)))"}"# + "\n"
    try? Data(boundary.utf8).write(to: comp.appendingPathComponent("s4.jsonl"))
    var idx4 = FolderIndex()
    idx4.refresh(dir: comp, since: 0, dayStart: 0)
    check("K8 compaction call (50 s) ⇒ the chat's compaction, not background",
          idx4.nearest(to: T.timeIntervalSince1970, duration: 60)?.kind == .compaction)
    check("K9 a boundary is not a message and not a chat cost",
          idx4.messagesByChat.isEmpty && idx4.tokensByChat.isEmpty)
}

// «درخواستِ امروز» only counts what was priced: a 404 has no response id
// (the countTokens route OpenRouter lacks), and a locally answered count_tokens
// row is deliberately unpriced. Raw line counting read 1522 where 1129 calls
// had cost anything.
do {
    let day = "2026-11-22"
    let text = """
    {"time_utc": "2026-11-22T10:00:00+00:00", "status": 200, "response_id": "gen-a"}
    {"time_utc": "2026-11-22T10:01:00+00:00", "status": 404, "response_id": null}
    {"time_utc": "2026-11-22T10:02:00+00:00", "status": 200, "response_id": null}
    {"time_utc": "2026-11-22T10:03:00+00:00", "status": 200, "response_id": ""}
    {"time_utc": "2026-11-21T23:59:00+00:00", "status": 200, "response_id": "gen-b"}
    """
    check("P1 a 404, a count_tokens row and another day stay out of the count",
          UsageCollector.countPricedRows(text, day: day) == 1)
    check("P2 the same text for the other day counts its own priced row",
          UsageCollector.countPricedRows(text, day: "2026-11-21") == 1)
    check("P3 an empty trace counts nothing", UsageCollector.countPricedRows("", day: day) == 0)
}

// ۲۲ نوامبر ۲۰۲۶: پوشهٔ بی‌شماره همه «۰» می‌شد، پس ۱۱۶ ردیف از سشنِ
// 0th-day-salamat صاحب نداشت. حالا هر پوشهٔ بی‌شماره نامِ خودش را می‌برد.
check("S1 136th-day-… → 136", projectIDForFolder("136th-day-fix-rtl-claude") == "136")
check("S2 0th-day-salamat keeps its own name", projectIDForFolder("0th-day-salamat") == "0th-day-salamat")
check("S3 000-BRAIN keeps its own name", projectIDForFolder("000-BRAIN") == "000-BRAIN")
check("S4 two zero folders never collapse", projectIDForFolder("000-BRAIN") != projectIDForFolder("0th-day-salamat"))
check("S5 path, space or over-long name → nil",
      projectIDForFolder("../x") == nil && projectIDForFolder("0th day") == nil
      && projectIDForFolder(String(repeating: "a", count: 65)) == nil)
check("S6 a plain number folder stays a number", projectIDForFolder("136") == "136")
do {
    // The launch file is read only to name rows the log already locked as
    // unknown; anything outside the workspace or without a folder stays nil.
    let text = """
    {"run_id":"r1","cwd":"/Users/x/1-MY-WORK/0th-day-salamat"}
    {"run_id":"r2","cwd":"/Users/x/1-MY-WORK/136th-day-fix-rtl-claude"}
    {"run_id":"r3","cwd":"/private/var/folders/t-4c"}
    {"run_id":"r4"}
    """
    let map = RunRegistry.parse(text, workRoot: "/Users/x/1-MY-WORK")
    check("S7 an old unknown row gets its folder name", map["r1"] == "0th-day-salamat")
    check("S8 a numbered folder still maps to its number", map["r2"] == "136")
    check("S9 outside the workspace or no folder → unnamed", map["r3"] == nil && map["r4"] == nil)
}

do {
    // End to end: a locked `unknown` row is named through its run; a row that
    // already has a project is never overridden by the launch file.
    func row(_ p: String, _ s: String) -> Data {
        Data(#"{"time_utc":"2026-11-22T10:00:00+00:00","project":"\#(p)","sender_run":"\#(s)","status":200,"response_id":"g"}"#.utf8)
    }
    let reg: (String) -> String? = { $0 == "RUN-1" ? "0th-day-salamat" : nil }
    check("S10 unknown row named from its run",
          UsageCollector.parseTrace(row("unknown", "RUN-1"), resolveRun: reg)?.project == "0th-day-salamat")
    check("S11 a named row is not overridden",
          UsageCollector.parseTrace(row("136", "RUN-1"), resolveRun: reg)?.project == "136")
    check("S12 an unrecorded run stays unknown",
          UsageCollector.parseTrace(row("unknown", "RUN-9"), resolveRun: reg)?.project == "unknown")
}

do {
    // Already-priced `unknown` rows: the offset has moved past them, so their
    // dollars would stay nameless. The trace line still carries the sender.
    let trace = """
    {"time_utc":"2026-11-22T10:00:00+00:00","project":"unknown","sender_run":"RUN-1","status":200,"response_id":"g1"}
    {"time_utc":"2026-11-22T10:01:00+00:00","project":"unknown","sender_run":"RUN-9","status":200,"response_id":"g2"}
    {"time_utc":"2026-11-22T10:02:00+00:00","project":"136","sender_run":"RUN-1","status":200,"response_id":"g3"}
    {"time_utc":"2026-11-22T10:03:00+00:00","project":"unknown","sender_run":"unknown","status":200,"response_id":"g4"}
    """
    let senders = UsageCollector.unknownSenders(trace, wanted: ["g1", "g2", "g3", "g4"])
    check("S13 only the wanted unknown rows feed the relabel",
          senders["g1"] == "RUN-1" && senders["g4"] == "unknown" && senders["g3"] == nil)
    func pr(_ id: String, _ project: String, _ cost: Double) -> Priced {
        Priced(id: id, cost: cost, ts: 0, project: project, model: "m", provider: "p",
               prompt: 0, cached: 0, completion: 0)
    }
    let prices = ["g1": pr("g1", "unknown", 0.5), "g2": pr("g2", "unknown", 0.05),
                  "g3": pr("g3", "136", 0.03)]
    let reg: (String) -> String? = { $0 == "RUN-1" ? "0th-day-salamat" : nil }
    let fixed = UsageCollector.relabel(prices, senders: senders, resolve: reg)
    // The wiring init uses: trace text in, named rows out.
    do {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("run-\(getpid()).jsonl")
        try? Data(trace.utf8).write(to: u)
        let fromFile = UsageCollector.relabelUnknown(prices, traceURL: u, resolve: reg)
        check("S19 init's file read names g1 and leaves g2",
              fromFile["g1"]?.project == "0th-day-salamat" && fromFile["g2"]?.project == "unknown")
        try? FileManager.default.removeItem(at: u)
    }
    check("S18 the relabel the app runs names g1 and leaves g2",
          UsageCollector.relabelUnknown(prices, traceText: trace, resolve: reg)["g1"]?.project == "0th-day-salamat"
          && UsageCollector.relabelUnknown(prices, traceText: trace, resolve: reg)["g2"]?.project == "unknown")
    check("S14 an unknown row is renamed from its launch", fixed["g1"]?.project == "0th-day-salamat")
    check("S15 a row with no recorded run stays unknown", fixed["g2"]?.project == "unknown")
    check("S16 a named row is never touched", fixed["g3"]?.project == "136")
    let sumBefore = prices.values.reduce(0) { $0 + $1.cost }
    let sumAfter = fixed.values.reduce(0) { $0 + $1.cost }
    check("S17 the money total does not move", abs(sumBefore - sumAfter) < 1e-12 && fixed.count == prices.count)
}

do {
    // The launch file is found next to the trace log the panel reads, newest
    // wins. Naming it wrongly here would silently turn the fallback off while
    // every parsing test stayed green (ناظر-۱۳۶، ۲۲ نوامبر).
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("rr-\(getpid())")
    defer { try? FileManager.default.removeItem(at: root) }
    let a = root.appendingPathComponent("a/live-request-trace")
    let b = root.appendingPathComponent("b/live-request-trace")
    try? FileManager.default.createDirectory(at: a, withIntermediateDirectories: true)
    try? FileManager.default.createDirectory(at: b, withIntermediateDirectories: true)
    let fa = a.appendingPathComponent("runs.jsonl"), fb = b.appendingPathComponent("runs.jsonl")
    try? Data("{}\n".utf8).write(to: fa)
    try? Data("{}\n".utf8).write(to: fb)
    try? FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1_700_000_000)], ofItemAtPath: fa.path)
    try? FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1_800_000_000)], ofItemAtPath: fb.path)
    let traces = [a.appendingPathComponent("requests.jsonl"), b.appendingPathComponent("requests.jsonl")]
    check("S20 the newest launch file is the one read", RunRegistry.file(in: traces)?.path == fb.path)
    try? FileManager.default.removeItem(at: fb)
    check("S21 with no launch file after the trace there is nothing to read",
          RunRegistry.file(in: [b.appendingPathComponent("requests.jsonl")]) == nil)
}

print(fails == 0 ? "ALL PASS" : "\(fails) FAILED"); exit(fails == 0 ? 0 : 1)
