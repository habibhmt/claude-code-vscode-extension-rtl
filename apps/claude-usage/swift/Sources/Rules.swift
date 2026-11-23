import Foundation

/// The notification rules, kept free of AppKit so the tests can build them
/// (definitions 02 and 03). App.swift only delivers what these decide.
enum Rules {
    /// Latin digits and separators → Persian, for notification text only.
    static func fa(_ s: String) -> String {
        var out = ""
        for ch in s {
            if let d = ch.wholeNumberValue, ch.isNumber, d < 10 {
                out.append(Character(UnicodeScalar(0x06F0 + d)!))
            } else if ch == "," { out.append("٬") }
            else { out.append(ch) }
        }
        return out
    }

    /// U+200F (RLM) forces the whole line right-to-left: without it macOS
    /// aligns by the first strong character, so a line starting with the
    /// model name ("opus-5") came out left-aligned in a Persian banner.
    static let rlm = "\u{200F}"

    // ---- «جواب آماده شد» (definition 02) --------------------------------
    /// A chat's answer finished since the last scan. The first scan after
    /// launch only records what is there — otherwise every recent chat
    /// would ring at once.
    static func finished(prev: String?, now: String, firstScan: Bool) -> Bool {
        !firstScan && prev != nil && prev != now
    }

    static let hotTokens = 150_000

    /// 22 Oct 03:00: ~20 agents answering each other rang a banner every
    /// 24 s and kept NotificationCenter at 47% CPU. Now each chat rings at
    /// most once an hour, and all chats together at most six banners an hour;
    /// past that the answer still lands in the list, silently. He never asked
    /// for a cap: it only applies to turns started by another agent or a task.
    struct ReplyGate {
        static let perChat: TimeInterval = 3600
        static let bannersPerHour = 6
        private(set) var lastByChat: [String: Date] = [:]
        private(set) var banners: [Date] = []

        enum Verdict: Equatable { case banner, silent, skip }

        /// An answer to something he typed himself always rings and is not counted.
        mutating func verdict(chat: String, fromHuman: Bool = false, now: Date = Date()) -> Verdict {
            if fromHuman { return .banner }
            if let last = lastByChat[chat], now.timeIntervalSince(last) < Self.perChat { return .skip }
            lastByChat[chat] = now
            banners.removeAll { now.timeIntervalSince($0) >= 3600 }
            guard banners.count < Self.bannersPerHour else { return .silent }
            banners.append(now)
            return .banner
        }
    }

    static func finishedText(ctxTokens: Int, ctxText: String, model: String) -> (title: String, body: String) {
        let hot = ctxTokens > hotTokens
        return (rlm + (hot ? "🔴 " : "") + "جواب آماده شد",
                rlm + "کانتکست \(fa(ctxText)) توکن · \(model)" + (hot ? " ⚠️" : ""))
    }

    // ---- زنگِ کش (definition 03) ----------------------------------------
    /// The prompt cache dies 60 min after the last answer; he wants a nudge at
    /// these minutes so he can send something before it goes cold.
    static let cacheMarks = [30, 45, 50, 55]

    /// The highest mark reached, or nil once the hour is over (too late to help).
    static func cacheMark(elapsed: Double, unit: Double = 60) -> Int? {
        guard elapsed < 60 * unit else { return nil }
        return cacheMarks.last { elapsed >= Double($0) * unit }
    }

    /// 22 Oct 05:00–05:10: 7 of 17 notifications were chimes for agents' chats.
    /// The chime stays for every chat (24 Sep: «برای همه چت ها باشه»); only a
    /// chat whose last turn he started himself rings out loud.
    static func cacheLoud(fromHuman: Bool) -> Bool { fromHuman }

    static func cacheText(mark: Int, ctxText: String) -> (title: String, body: String) {
        (rlm + "⏰ \(fa(String(mark))) دقیقه — \(fa(String(60 - mark))) دقیقه وقت داری",
         rlm + "حجم: \(fa(ctxText)) توکن")
    }
}
