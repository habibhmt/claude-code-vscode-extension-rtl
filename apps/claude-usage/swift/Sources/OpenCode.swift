import Foundation

/// opencode-go.json — همان فایلی که abzar/darvaze/scripts/opencode_usage.py
/// هر ۱۵ دقیقه می‌نویسد (com.habib.opencode-usage). عددها از usage.opencode.list_cost
/// ِ خودِ پاسخ‌ها می‌آید، پس «چقدر از هر مدل مانده» بی‌حدس است (حبیب ۲۲ نوامبر).
/// فایل نبود یا خراب بود ⇒ nil؛ هیچ‌جا صفر نشان داده نمی‌شود (شرطِ ناظر-۱۳۶).
enum OpenCode {
    static let path = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/claude-usage-bar/opencode-go.json")

    static let names: [String: String] = [
        "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
        "claude-haiku-5-5": "Claude Haiku 5.5",
        "kimi-k3": "Kimi K3",
    ]

    /// عدد و علامتِ دلار را در یک جزیرهٔ چپ‌به‌راست می‌گذارد. بدونِ این، منوی اپ‌کیت
    /// «$0.79 از $60» را به‌هم‌ریخته نشان می‌دهد (سنجیده: ۲۲ نوامبر ۰۹:۰۳).
    static func ltr(_ s: String) -> String { "\u{2066}" + s + "\u{2069}" }
    /// جملهٔ فارسی در جزیرهٔ راست‌به‌چپ؛ بدونِ این، «از» و «مانده» جابه‌جا
    /// دیده می‌شوند حتی وقتی عدد سالم است (سنجیده: ۲۲ نوامبر ۰۹:۰۴).
    static func rtl(_ s: String) -> String { "\u{2067}" + s + "\u{2069}" }

    struct Model {
        let id: String
        let name: String
        let spent: Double
        let cap: Double
        let used: Double
        /// مانده بر حسب درصد، از ۱۰۰ منهای used_percent
        var left: Int { max(0, min(100, Int((100 - used).rounded()))) }
        var tag: String {
            id.hasPrefix("deepseek") ? "DS" : id.hasPrefix("claude-haiku") ? "HA"
                : id.hasPrefix("kimi") ? "K3" : String(id.prefix(2)).uppercased()
        }
        /// نام لاتین بیرون، جملهٔ فارسی داخلِ جزیرهٔ RTL، عدد و دلار داخلِ جزیرهٔ LTR.
        var text: String {
            let cash = OpenCode.ltr(String(format: "$%.2f", spent))
            let capText = OpenCode.ltr(String(format: "$%.0f", cap))
            let percent = OpenCode.ltr("\(left)%")
            return name + "  " + "\(cash) of \(capText) · \(percent) left"
        }
    }

    /// هزینهٔ یک چت (گفتگو) در ماه — از `chat_cost.sessions` (ناظر-۱۳۶، ۲۳ نوامبر ۲۰۲۶).
    struct ChatCost {
        let id: String
        let cwd: String
        /// نامِ چت از داده: نامِ سشن، وگرنه اولین پیامِ آدم، وگرنه تهی (اپ ساعت نشان می‌دهد).
        /// شناسه هیچ‌جا برچسب نیست (حبیب ۲۳ نوامبر ۱۹:۰۹: «شناسه چت رو نوشتی که نمی‌فهممش»).
        let title: String
        let cost: Double
        let requests: Int
        /// شکستِ هزینه در همان چت، مدل‌به‌مدل — همان چیزی که حبیب «به تفکیک» می‌خواهد.
        let models: [(name: String, cost: Double)]
        /// بازهٔ زمانیِ چت (ISO) — برای متمایزکردنِ چت‌های هم‌پوشه.
        let first: String?
        let last: String?
        /// کوتاه‌شدهٔ مسیرِ فولدر برای نمایش؛ تهی ⇒ «نامعلوم»
        var where_: String {
            guard !cwd.isEmpty else { return "" }
            let parts = cwd.split(separator: "/")
            return parts.suffix(2).joined(separator: "/")
        }
        var text: String {
            let cash = OpenCode.ltr(String(format: "$%.2f", cost))
            let count = OpenCode.ltr("\(requests)")
            let place = where_.isEmpty ? "" : " · " + OpenCode.ltr(where_)
            return "\(cash) · \(count) req\(place)"
        }
    }

    /// هزینهٔ یک فولدر = جمعِ چت‌هایش.
    struct FolderCost {
        let label: String
        let cwd: String
        let cost: Double
        let chats: Int
        let requests: Int
        var text: String {
            let cash = OpenCode.ltr(String(format: "$%.2f", cost))
            let count = OpenCode.ltr("\(chats)")
            return "\(cash) · \(count) chats"
        }
    }

    /// فولدر + چت‌های زیرش (گران‌ترین اول) — ترتیبِ نمایشِ پنل: اول فولدر، بعد چت‌ها
    /// (حبیب ۲۳ نوامبر ۲۰۲۶ ۱۹:۰۹: «اول فولدر رو مینوشتی بعد به تفکیک … چت به اسم فلان»).
    struct FolderGroup: Identifiable {
        let label: String
        let cost: Double
        let chats: [ChatCost]
        var id: String { label }
    }

    struct Snapshot {
        let models: [Model]
        let rolling: Double?
        let weekly: Double?
        let monthly: Double?
        /// ردیف‌های بی‌مدلِ ماه: شمرده‌شده در دروازه، نه تایپ‌شده در اپ
        let unpriced: Int
        let unpricedFrom: String?
        let unpricedTo: String?
        /// هزینهٔ چت‌ها و فولدرها؛ تهی ⇒ این بخش نشان داده نمی‌شود (نه صفر)
        let chats: [ChatCost]
        let folders: [FolderCost]
        /// لحظهٔ ساختِ فایلِ مصرف از خودِ فایل (نه زمانِ ساختگی) — برای خطِ «last update».
        let fetchedAt: String?
        let unknownLabel: String
        let unknownCost: Double
        let unknownRequests: Int

        /// درصدِ ماندهٔ مدلِ پیش‌فرض — عددِ اولِ نوار.
        var dsLeft: Int? { models.first { $0.id.hasPrefix("deepseek") }?.left }

        /// فولدرها با چت‌های زیرشان؛ فولدر و چت‌ها هر دو گران‌ترین‌اول.
        /// چت‌های یک فولدر با `cwd` یکی می‌شوند (همان قاعدهٔ ساختِ فولدر در پایتون).
        var folderGroups: [FolderGroup] {
            folders.map { folder in
                FolderGroup(label: folder.label, cost: folder.cost,
                            chats: chats.filter { $0.cwd == folder.cwd }
                                        .sorted { $0.cost > $1.cost })
            }
            .sorted { $0.cost > $1.cost }
        }
        /// جمعِ هزینهٔ ماه — عددِ دومِ نوار در حالتِ «فقط OpenCode».
        var monthCost: Double { models.reduce(0) { $0 + $1.spent } }

        /// قاعدهٔ نوار (تعریفِ ۲۸ §۵؛ حبیب ۲۳ نوامبر ۲۰۲۶ ۱۷:۲۱: «فقط چند عدد — درصدها و
        /// اعتبارِ باقی‌مانده») — تنها جای این تصمیم، تا آزمون‌پذیر باشد:
        /// هر تیک یک عدد: OpenCode ⇒ درصدِ مانده · OpenRouter ⇒ اعتبارِ باقی‌مانده.
        /// هیچ تیک ⇒ [] · هر دو ⇒ حداکثر دو عدد.
        static func menuBarParts(oc: OpenCode.Snapshot?, or: OpenRouter.Snapshot?,
                                 ocOn: Bool, orOn: Bool) -> [String] {
            var parts: [String] = []
            if ocOn, let oc, let left = oc.dsLeft {
                parts.append("\(left)%")
            }
            if orOn, let or, let credit = or.creditRemaining {
                parts.append(String(format: "$%.2f", credit))
            }
            return parts
        }

        private static func clock(_ iso: String) -> String {
            // 2026-11-22T03:58:07Z → 03:58Z
            iso.count >= 16 ? String(iso.dropFirst(11).prefix(5)) + "Z" : iso
        }

        var honestyNote: String? {
            guard unpriced > 0 else { return nil }
            let span = [unpricedFrom, unpricedTo].compactMap { $0 }.map(Snapshot.clock)
            let times = span.count == 2 ? OpenCode.ltr(span[0] + "–" + span[1]) : ""
            return "\(unpriced) unpriced requests \(times) not counted in spend"
        }
    }

    /// وضعیتِ قرمزِ دروازه — فایلِ جدا (`status.json`)، نوشتهٔ اتمیکِ خودِ دروازه.
    /// بود ⇒ یعنی یک سرویس خطا داده و دروازه به سرویسِ دیگر برنگشته (حبیب: «بایست و خبر بده»).
    struct Symptom {
        let state: String
        let provider: String
        let code: Int
        let message: String
        let at: String
        var text: String {
            let codeText = OpenCode.ltr(String(code))
            return "⚠︎ \(provider) error \(codeText) — \(message) (\(at.dropFirst(11).prefix(5)))"
        }
    }

    static let statusPath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("1-MY-WORK/136th-day-fix-rtl-claude/abzar/darvaze/.runtime/opencode-go/status.json")

    static func loadStatus() -> Symptom? {
        guard let data = try? Data(contentsOf: statusPath),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let state = root["state"] as? String
        else { return nil }
        return Symptom(state: state,
                       provider: (root["provider"] as? String) ?? "?",
                       code: (root["code"] as? NSNumber)?.intValue ?? 0,
                       message: (root["message"] as? String) ?? "",
                       at: (root["at"] as? String) ?? "")
    }

    static func load() -> Snapshot? {
        guard let data = try? Data(contentsOf: path),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return nil }
        var models: [Model] = []
        for (id, raw) in (root["per_model"] as? [String: Any]) ?? [:] {
            guard let row = raw as? [String: Any] else { continue }
            // فقط سهمیهٔ اوپن‌کد سقف دارد؛ مدل‌های OpenRouter پولشان جای دیگری
            // شمرده می‌شود و نباید «$0 از $0» نشان داده شوند (۲۲ نوامبر ۲۰:۲۲).
            if let provider = row["provider"] as? String, provider != "opencode" { continue }
            func num(_ key: String) -> Double { (row[key] as? NSNumber)?.doubleValue ?? 0 }
            models.append(Model(id: id, name: names[id] ?? id,
                                spent: num("list_cost"), cap: num("monthly_cap"),
                                used: num("used_percent")))
        }
        guard !models.isEmpty else { return nil }
        models.sort { $0.used > $1.used }
        let usage = (root["usage"] as? [String: Any]) ?? [:]
        func pct(_ key: String) -> Double? {
            ((usage[key] as? [String: Any])?["percent"] as? NSNumber)?.doubleValue
        }
        let honesty = (root["honesty"] as? [String: Any]) ?? [:]
        // هزینهٔ هر چت و فولدر — اگر بخش نبود، فهرست‌ها تهی می‌مانند و اپ چیزی نمی‌سازد.
        let cost = (root["chat_cost"] as? [String: Any]) ?? [:]
        var chats: [ChatCost] = []
        for raw in (cost["sessions"] as? [[String: Any]]) ?? [] {
            guard let id = raw["session_id"] as? String else { continue }
            var perModel: [(name: String, cost: Double)] = []
            for (name, value) in (raw["models"] as? [String: Any]) ?? [:] {
                perModel.append((names[name] ?? name, (value as? NSNumber)?.doubleValue ?? 0))
            }
            perModel.sort { $0.cost > $1.cost }
            chats.append(ChatCost(id: id, cwd: raw["cwd"] as? String ?? "",
                                  title: raw["title"] as? String ?? "",
                                  cost: (raw["cost"] as? NSNumber)?.doubleValue ?? 0,
                                  requests: (raw["requests"] as? NSNumber)?.intValue ?? 0,
                                  models: perModel,
                                  first: raw["first"] as? String,
                                  last: raw["last"] as? String))
        }
        var folders: [FolderCost] = []
        for raw in (cost["folders"] as? [[String: Any]]) ?? [] {
            folders.append(FolderCost(label: raw["label"] as? String ?? "",
                                      cwd: raw["cwd"] as? String ?? "",
                                      cost: (raw["cost"] as? NSNumber)?.doubleValue ?? 0,
                                      chats: (raw["chats"] as? NSNumber)?.intValue ?? 0,
                                      requests: (raw["requests"] as? NSNumber)?.intValue ?? 0))
        }
        let unknown = (cost["unknown"] as? [String: Any]) ?? [:]
        return Snapshot(models: models, rolling: pct("rolling"),
                        weekly: pct("weekly"), monthly: pct("monthly"),
                        unpriced: (honesty["unpriced_requests"] as? NSNumber)?.intValue ?? 0,
                        unpricedFrom: honesty["from"] as? String,
                        unpricedTo: honesty["to"] as? String,
                        chats: chats, folders: folders,
                        fetchedAt: root["fetched_at"] as? String,
                        unknownLabel: unknown["label"] as? String ?? "Unattributed",
                        unknownCost: (unknown["cost"] as? NSNumber)?.doubleValue ?? 0,
                        unknownRequests: (unknown["requests"] as? NSNumber)?.intValue ?? 0)
    }
}
