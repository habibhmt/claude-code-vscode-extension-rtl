import AppKit
import SwiftUI

/// پنجرهٔ شناورِ دو‌تبی با شیشهٔ رسمیِ مک‌اواس ۲۶ (تعریفِ ۲۸ §۵؛ حبیب ۲۳ نوامبر ۲۰۲۶ ۱۷:۲۱
/// و ۱۷:۵۶: «اون اپ قدیمی ۱۸۶ خیلی یو ای قشنگی داشت» ⇒ محتوا SwiftUI با همان زبانِ بصری).
final class UsagePanel: NSPanel {
    init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 480, height: 620),
                   styleMask: [.titled, .closable, .resizable, .fullSizeContentView, .utilityWindow],
                   backing: .buffered, defer: false)
        isFloatingPanel = true
        // پنلِ کمکی (utilityWindow) به‌طورِ پیش‌فرض با غیرفعال‌شدنِ اپ ناپدید می‌شود؛
        // این پنل باید رویِ کارِ حبیب بماند (سنجیده ۲۳ نوامبر ۱۸:۴۳: با کلیک روی کروم غیب شد).
        hidesOnDeactivate = false
        level = .floating
        isMovableByWindowBackground = true
        titleVisibility = .hidden
        titlebarAppearsTransparent = true
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        // بستن = پنهان شدن، نه آزاد شدن؛ اپ و آیکنِ نوار سرِ جایشان می‌مانند.
        isReleasedWhenClosed = false
        setFrameAutosaveName("usage-panel")
        // زیرِ این پهنا، برچسبِ تیک‌ها دو خطی می‌شود (سنجیده ۲۳ نوامبر ۱۸:۵۲).
        minSize = NSSize(width: 460, height: 420)
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    }

    /// اگر پنجره هیچ‌جای هیچ صفحه‌ای نیست، به گوشهٔ بالا-راستِ صفحهٔ اصلی بیاور.
    func clampToScreens() {
        guard let main = NSScreen.main else { return }
        guard !NSScreen.screens.contains(where: { $0.visibleFrame.intersects(frame) }) else { return }
        let visible = main.visibleFrame
        setFrameOrigin(NSPoint(x: visible.maxX - frame.width - 40,
                               y: visible.maxY - frame.height - 40))
    }
}

final class UsagePanelController: NSObject {
    static let ocTickKey = "menubar.opencode"
    static let orTickKey = "menubar.openrouter"

    /// تیکِ ننوشته = روشن؛ تا نوار از روزِ اول درصد و اعتبار را نشان دهد.
    static func tickValue(_ key: String) -> Bool {
        UserDefaults.standard.object(forKey: key) as? Bool ?? true
    }

    let panel = UsagePanel()
    private let store = UsageStore()
    var onTickChanged: (() -> Void)?
    var onRefresh: (() -> Void)?

    override init() {
        super.init()
        store.onTickChanged = { [weak self] in self?.onTickChanged?() }
        build()
    }

    private func build() {
        let root = UsageRootView(store: store,
                                 onRefresh: { [weak self] in self?.onRefresh?() },
                                 onClose: { [weak self] in self?.panel.orderOut(nil) })
        let hosting = NSHostingView(rootView: root)
        hosting.wantsLayer = true

        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView()
            glass.style = .regular
            glass.cornerRadius = 18
            glass.contentView = hosting
            panel.contentView = glass
        } else {
            let blur = NSVisualEffectView()
            blur.material = .hudWindow
            blur.blendingMode = .behindWindow
            blur.state = .active
            hosting.frame = blur.bounds
            hosting.autoresizingMask = [.width, .height]
            blur.addSubview(hosting)
            panel.contentView = blur
        }

        // آزمونِ «شیشهٔ واقعی» (ناظر-۱۳۶ ۱۷:۲۲): فقط با USAGE_PANEL_DEBUG کلاس ثبت می‌شود.
        if ProcessInfo.processInfo.environment["USAGE_PANEL_DEBUG"] != nil,
           let view = panel.contentView {
            UserDefaults.standard.set(String(describing: type(of: view)), forKey: "panel.debug.contentView")
        }
    }

    func show(oc: OpenCode.Snapshot?, or: OpenRouter.Snapshot?) {
        reload(oc: oc, or: or)
        // اولین بار: زیرِ آیکنِ نوار، گوشهٔ بالا-راست؛ بعد از آن هر جا حبیب گذاشته باشد.
        if UserDefaults.standard.object(forKey: "usage-panel.placed") == nil {
            UserDefaults.standard.set(true, forKey: "usage-panel.placed")
            if let screen = NSScreen.main {
                let v = screen.visibleFrame
                panel.setFrameOrigin(NSPoint(x: v.maxX - panel.frame.width - 12,
                                             y: v.maxY - panel.frame.height - 6))
            }
        }
        panel.orderFrontRegardless()
        panel.clampToScreens()
    }

    func reload(oc: OpenCode.Snapshot?, or: OpenRouter.Snapshot?) {
        store.set(oc: oc, or: or)
    }
}
