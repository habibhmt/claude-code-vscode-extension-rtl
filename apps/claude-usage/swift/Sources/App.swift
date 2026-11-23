import AppKit
import UserNotifications

let kBundleID = "com.habib.ClaudeUsage.v5"

/// ۳۰ اکتبر: «فیچرهای اضافت رو پاک کن و فقط همون درصد ها بمونه»؛ ۲۲ نوامبر
/// ۱۹:۱۵: «اون قسمت های فیبل و کلاد و چت جی پی تی رو توی اپ حذف کن» — پس اپ
/// فقط OpenCode Go را نشان می‌دهد: دو عدد در نوار، همهٔ مدل‌ها در منو، و دو
/// آلارمِ Alarms.swift. هیچ تماسی با Anthropic یا ChatGPT زده نمی‌شود.
final class AppDelegate: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    let alarms = Alarms()
    var alarmTimer: Timer?
    /// OpenCode Go — فقط نمایش؛ خالی بود یعنی فایل نیست و بخشی هم نشان داده نمی‌شود
    var oc: OpenCode.Snapshot?
    /// OpenRouter — فایلِ نبود/خراب ⇒ عددِ قبلی می‌ماند، صفر نمی‌شود.
    var or: OpenRouter.Snapshot?
    var ocTimer: Timer?
    /// پنجرهٔ شناورِ دو‌تبی (تعریفِ ۲۸)؛ بستنش اپ را نمی‌کشد.
    let panelController = UsagePanelController()
    /// وضعیتِ قرمزِ دروازه؛ هر `at` تازه ⇒ **یک** اعلان، نه تکرار
    var ocSymptom: OpenCode.Symptom?
    var lastNotified: String?

    // MARK: menu bar
    /// قاعدهٔ نوار (تعریفِ ۲۸، ناظر-۱۳۶ ۲۳ نوامبر ۲۰۲۶ ۱۷:۰۹) — ثابت:
    /// هیچ تیک ⇒ فقط آیکن · فقط OpenCode ⇒ «DS <مانده>% · $<هزینهٔ ماه>» ·
    /// فقط OpenRouter ⇒ «$<هزینهٔ امروز> · <درخواست>» ·
    /// هر دو ⇒ **یک عدد از هر تب** (DS و دلارِ امروز) تا از دو عدد بیشتر نشود.
    private func renderTitle() {
        guard let b = item?.button else { return }
        let font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        if ocSymptom != nil {
            // خطا خبر است، نه عدد؛ تیک‌ها آن را پنهان نمی‌کنند («بایست و خبر بده»).
            b.attributedTitle = NSAttributedString(string: " ×", attributes: [
                .font: font, .foregroundColor: NSColor.systemRed])
            return
        }
        let ocOn = UsagePanelController.tickValue(UsagePanelController.ocTickKey)
        let orOn = UsagePanelController.tickValue(UsagePanelController.orTickKey)
        let parts = OpenCode.Snapshot.menuBarParts(oc: oc, or: or, ocOn: ocOn, orOn: orOn)
        guard !parts.isEmpty else {
            b.attributedTitle = NSAttributedString(string: " ")
            return
        }
        b.attributedTitle = NSAttributedString(string: "  " + parts.joined(separator: " · "), attributes: [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .regular),
            .foregroundColor: NSColor.secondaryLabelColor,
        ])
    }

    /// فایل را دوباره می‌خواند؛ فایلِ خراب ⇒ عددِ قبلی سرِ جایش می‌ماند، صفر نمی‌شود.
    private func refreshOpenCode() {
        if let fresh = OpenCode.load() { oc = fresh }
        ocSymptom = OpenCode.loadStatus()
        if let symptom = ocSymptom, symptom.at != lastNotified {
            lastNotified = symptom.at
            notify(symptom)
        }
        if ocSymptom == nil { lastNotified = nil }
        // OpenRouter: فایلِ خراب یا نبود ⇒ عددِ قبلی سرِ جایش می‌ماند (آزمونِ ب).
        if let fresh = OpenRouter.load() { or = fresh }
        renderTitle()
        if panelController.panel.isVisible {
            panelController.reload(oc: oc, or: or)
        }
    }

    /// یک اعلان برای هر وضعیتِ تازه — «بایست و خبر بده»، نه اسپم.
    private func notify(_ symptom: OpenCode.Symptom) {
        let content = UNMutableNotificationContent()
        content.title = "Model service not responding"
        content.body = "\(symptom.provider) · code \(symptom.code) — \(symptom.message)"
        content.sound = .default
        let request = UNNotificationRequest(identifier: "oc-status-\(symptom.at)",
                                            content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    /// Click: OpenCode's models, Refresh and Quit — no Claude, Fable or ChatGPT.
    /// منو حذف شد (حبیب ۲۳ نوامبر ۲۰۲۶ ۱۷:۲۱: «با زدن روی اون قسمتِ منوبار یه پنل … باز بشه»).
    /// کلیک روی نوار حالا پنل را باز/بسته می‌کند، نه منو.
    @objc private func togglePanel() {
        if panelController.panel.isVisible {
            panelController.panel.orderOut(nil)
        } else {
            panelController.show(oc: oc, or: or)
        }
    }

    // MARK: data
    /// Refresh only re-reads the OpenCode file: the Claude limits call and the
    /// ChatGPT probe are gone (حبیب ۲۲ نوامبر ۱۹:۱۵).
    @objc func refreshNow() { refreshOpenCode() }

    /// پنجرهٔ شناور: باز و به‌روز. بستنش فقط پنهان می‌کند؛ اپ زنده می‌ماند.
    @objc private func openPanel() { panelController.show(oc: oc, or: or) }

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
        // کلیک روی نوار ⇒ پنل (حبیب ۲۳ نوامبر ۱۷:۲۱)؛ منو دیگر ساخته نمی‌شود.
        item.button?.target = self
        item.button?.action = #selector(togglePanel)
        panelController.onTickChanged = { [weak self] in self?.renderTitle() }
        panelController.onRefresh = { [weak self] in self?.refreshOpenCode() }
        refreshOpenCode()
        // فایلِ OpenCode هر ۱۵ دقیقه عوض می‌شود؛ دقیقه‌ای یک بار خواندنش ارزان است
        ocTimer = Timer(timeInterval: 60, repeats: true) { [weak self] _ in self?.refreshOpenCode() }
        ocTimer?.tolerance = 10
        if let ocTimer { RunLoop.main.add(ocTimer, forMode: .common) }
        renderTitle()

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
