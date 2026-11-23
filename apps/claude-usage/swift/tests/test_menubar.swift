import Foundation

// آزمونِ قاعدهٔ نوار و رفتارِ فایلِ خراب (تعریفِ ۲۸ §۵؛ ناظر-۱۳۶ ۲۳ نوامبر ۲۰۲۶ ۱۷:۰۹).
// ساخت (کدِ سطحِ بالا فقط در فایلی به نامِ main.swift مجاز است):
//   cp tests/test_menubar.swift /tmp/main.swift
//   swiftc -O Sources/OpenCode.swift Sources/OpenRouter.swift /tmp/main.swift -o /tmp/test_menubar
// اجرا: /tmp/test_menubar

func snapOC(left: Int = 99, spent: Double = 8.15) -> OpenCode.Snapshot {
    let model = OpenCode.Model(id: "deepseek-v4.1-flash", name: "DeepSeek",
                               spent: spent, cap: 200, used: Double(100 - left))
    return OpenCode.Snapshot(models: [model], rolling: 4, weekly: 4, monthly: 5,
                             unpriced: 0, unpricedFrom: nil, unpricedTo: nil,
                             chats: [], folders: [], fetchedAt: nil,
                             unknownLabel: "Unattributed (before tracking)",
                             unknownCost: 0, unknownRequests: 0)
}

func snapOR(spend: Double = 0.16, requests: Int = 217) -> OpenRouter.Snapshot {
    OpenRouter.Snapshot(todaySpend: spend, todayRequests: requests,
                        creditRemaining: 7.14, creditTotal: 198.73,
                        folders: [], updated: "")
}

var bad = 0
func check(_ name: String, _ ok: Bool, _ detail: String) {
    print("\(name): \(detail) \(ok ? "✅" : "❌")")
    if !ok { bad += 1 }
}

let oc = snapOC(), or = snapOR()

// هیچ تیک ⇒ فقط آیکن
let none = OpenCode.Snapshot.menuBarParts(oc: oc, or: or, ocOn: false, orOn: false)
check("۱ هیچ تیک", none.isEmpty, "\(none)")

// فقط OpenCode ⇒ درصدِ مانده
let ocOnly = OpenCode.Snapshot.menuBarParts(oc: oc, or: or, ocOn: true, orOn: false)
check("۲ فقط OpenCode", ocOnly == ["99%"], "\(ocOnly)")

// فقط OpenRouter ⇒ اعتبارِ باقی‌مانده
let orOnly = OpenCode.Snapshot.menuBarParts(oc: oc, or: or, ocOn: false, orOn: true)
check("۳ فقط OpenRouter", orOnly == ["$7.14"], "\(orOnly)")

// هر دو ⇒ حداکثر دو عدد: درصد + اعتبار
let both = OpenCode.Snapshot.menuBarParts(oc: oc, or: or, ocOn: true, orOn: true)
check("۴ هر دو", both == ["99%", "$7.14"] && both.count <= 2, "\(both)")

// تیکِ یکی روی دیگری اثر نگذارد: خروجیِ «فقط OpenRouter» با ocOn=false همان است
// چه oc باشد چه نباشد.
let orOnlyNoOC = OpenCode.Snapshot.menuBarParts(oc: nil, or: or, ocOn: false, orOn: true)
check("۵ استقلالِ تیک", orOnlyNoOC == orOnly, "\(orOnlyNoOC)")

// فایلِ خراب ⇒ load باید nil بدهد، نه عددِ صفر
let path = OpenRouter.path
let backup = (try? Data(contentsOf: path))
try? "{ این json نیست".data(using: .utf8)?.write(to: path)
let corrupt = OpenRouter.load()
check("۶ فایلِ خراب ⇒ nil", corrupt == nil, corrupt == nil ? "nil" : "مقدار داد")
if let backup { try? backup.write(to: path) }
let restored = OpenRouter.load()
check("۷ برگشتنِ فایل", restored != nil, restored == nil ? "nil" : "خوب")

print("جمع: " + (bad == 0 ? "سبز" : "\(bad) ❌"))
exit(bad == 0 ? 0 : 1)
