import Foundation

var cal = Calendar(identifier: .gregorian)
cal.timeZone = TimeZone(identifier: "Asia/Tehran")!
func at(_ s: String) -> Date {   // "2026-10-15 14:00" Tehran
    let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone
    f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)!
}
var fails = 0
func check(_ name: String, _ ok: Bool) { print((ok ? "PASS " : "FAIL ") + name); if !ok { fails += 1 } }

// 01 panel: the three bars from a usage response.
let usageJSON: [String: Any] = [
    "five_hour": ["utilization": 12.4], "seven_day": ["utilization": 67.37],
    "limits": [
        ["kind": "session", "percent": 12, "resets_at": "2026-10-22T05:00:00.000Z"],
        ["kind": "weekly_all", "percent": 67, "resets_at": "2026-10-26T09:00:00Z"],
        ["kind": "weekly_scoped", "percent": 40, "scope": ["model": ["display_name": "Opus"]]],
        ["kind": "weekly_scoped", "percent": 64, "scope": ["model": ["display_name": "Fable"]]],
    ]]
let lr = UsageEngine.parseLimits(usageJSON)
func pctOf(_ id: String) -> Double? { lr.first { $0.id == id }?.percent }
check("U1 three bars: session, weekly, fable", lr.map(\.id) == ["session", "weekly", "fable"])
check("U2 weekly takes the fractional 67.37, not the rounded 67", pctOf("weekly") == 67.37)
check("U3 fable from its own scope (64), not Opus (40)", pctOf("fable") == 64)
check("U4 reset time read (with and without fractions)",
      lr.first { $0.id == "session" }?.resetsAt != nil && lr.first { $0.id == "weekly" }?.resetsAt != nil)
check("U5 empty response → no bars, no crash", UsageEngine.parseLimits([:]).isEmpty)

// ChatGPT's percentage, from the app-server's own answer.
let gptLine = Data(#"{"id":2,"result":{"rateLimits":{"primary":{"usedPercent":41,"resetsAt":1794185024}}}}"#.utf8)
let gptRow = ChatGPTUsage.parse(gptLine)
check("G1 percent and reset read", gptRow?.percent == 41 && gptRow?.resetsAt?.timeIntervalSince1970 == 1794185024)
check("G2 labelled ChatGPT", gptRow?.label == "ChatGPT")
check("G3 other lines ignored", ChatGPTUsage.parse(Data(#"{"id":1,"result":{}}"#.utf8)) == nil
      && ChatGPTUsage.parse(Data("not json".utf8)) == nil)

check("G4 4d 1h left reads 4d 1h, not 5d",
      LimitRow(id: "chatgpt", percent: 0, resetsAt: Date().addingTimeInterval(4 * 86400 + 3600 + 60)).resetText == "4d 1h")

// 10 nudge: only in the token's last 4 minutes (or after a 401), at most every 15 minutes.
do {
    let n0 = Date(timeIntervalSince1970: 1_800_000_000), past = Date.distantPast
    check("N1 5 min left → no nudge", !UsageEngine.shouldNudge(expiresAt: n0.addingTimeInterval(300), lastStatus: 200, lastNudge: past, now: n0))
    check("N2 3 min left → nudge", UsageEngine.shouldNudge(expiresAt: n0.addingTimeInterval(180), lastStatus: 200, lastNudge: past, now: n0))
    check("N3 3 min left but nudged 10 min ago → wait", !UsageEngine.shouldNudge(expiresAt: n0.addingTimeInterval(180), lastStatus: 200, lastNudge: n0.addingTimeInterval(-600), now: n0))
    check("N4 401 with a fresh token → nudge", UsageEngine.shouldNudge(expiresAt: n0.addingTimeInterval(7200), lastStatus: 401, lastNudge: past, now: n0))
    check("N5 the question goes to the model (not «auth status»), no session, no hooks, $0.01 cap",
          UsageEngine.nudgeArgs.contains("-p") && !UsageEngine.nudgeArgs.contains("auth")
          && UsageEngine.nudgeArgs.contains("--no-session-persistence")
          && UsageEngine.nudgeArgs.contains(#"{"disableAllHooks":true}"#) && UsageEngine.nudgeArgs.contains("0.01"))
}

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

print(fails == 0 ? "ALL PASS" : "\(fails) FAILED"); exit(fails == 0 ? 0 : 1)
