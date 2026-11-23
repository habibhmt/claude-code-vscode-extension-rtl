import Foundation

/// source-of-truth.json — فایلِ مصرفِ OpenRouter که پروکسیِ ۵۰۹۶۷ می‌نویسد.
/// فایل نبود یا خراب بود ⇒ nil؛ اپ عددِ قبلی را نگه می‌دارد و صفر نشان نمی‌دهد.
enum OpenRouter {
    static let path = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/ClaudeUsage/source-of-truth.json")

    /// یک چت در فولدر — با اسم (`title`) و شکستِ هزینهٔ زیرش (`children`).
    /// شکست از خودِ داده می‌آید (Compaction · Hads · Agents · Workflow · client)؛ چیزی ساخته نمی‌شود.
    struct Chat {
        let title: String
        let cost: Double
        let children: [(label: String, cost: Double)]
    }

    struct Folder {
        let name: String
        let cost: Double
        let requests: Int
        let chats: [Chat]
        var chatCount: Int { chats.count }
    }

    struct Snapshot {
        let todaySpend: Double
        let todayRequests: Int
        let creditRemaining: Double?
        let creditTotal: Double?
        let folders: [Folder]
        let updated: String

        var todayText: String {
            let cash = OpenCode.ltr(String(format: "$%.2f", todaySpend))
            let count = OpenCode.ltr("\(todayRequests)")
            return "Today \(cash) · \(count) req"
        }

        var creditText: String? {
            guard let left = creditRemaining, let total = creditTotal else { return nil }
            let cash = OpenCode.ltr(String(format: "$%.2f", left))
            let cap = OpenCode.ltr(String(format: "$%.2f", total))
            return "Credit left \(cash) of \(cap)"
        }
    }

    static func load() -> Snapshot? {
        guard let data = try? Data(contentsOf: path),
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return nil }
        let today = (root["today"] as? [String: Any]) ?? [:]
        let credit = (root["credit"] as? [String: Any]) ?? [:]
        var folders: [Folder] = []
        for raw in (root["folders"] as? [[String: Any]]) ?? [] {
            var chats: [Chat] = []
            for c in (raw["chats"] as? [[String: Any]]) ?? [] {
                var parts: [(label: String, cost: Double)] = []
                for kid in (c["children"] as? [[String: Any]]) ?? [] {
                    let label = (kid["label"] as? String)
                        ?? (kid["kind"] as? String) ?? "—"
                    parts.append((label, (kid["cost"] as? NSNumber)?.doubleValue ?? 0))
                }
                parts.sort { $0.cost > $1.cost }
                chats.append(Chat(title: (c["title"] as? String) ?? "",
                                  cost: (c["cost"] as? NSNumber)?.doubleValue ?? 0,
                                  children: parts))
            }
            chats.sort { $0.cost > $1.cost }
            folders.append(Folder(name: raw["name"] as? String ?? "—",
                                  cost: (raw["cost"] as? NSNumber)?.doubleValue ?? 0,
                                  requests: (raw["requests"] as? NSNumber)?.intValue ?? 0,
                                  chats: chats))
        }
        folders.sort { $0.cost > $1.cost }
        return Snapshot(todaySpend: (today["spend"] as? NSNumber)?.doubleValue ?? 0,
                        todayRequests: (today["requests"] as? NSNumber)?.intValue ?? 0,
                        creditRemaining: (credit["remaining"] as? NSNumber)?.doubleValue,
                        creditTotal: (credit["total"] as? NSNumber)?.doubleValue,
                        folders: folders,
                        updated: root["updated"] as? String ?? "")
    }
}
