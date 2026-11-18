import AppKit
import UserNotifications

let kBundleID = "com.habib.ClaudeUsage.v5"

/// Menu bar = live OpenRouter credit; dropdown = folders → chats → subagent /
/// extension calls with their exact dollar cost. The two alarms from
/// Alarms.swift are untouched and still watch `~/.claude/projects`.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let collector = UsageCollector()
    var item: NSStatusItem!
    var popover: NSPopover!
    var panel: PanelView!
    var truth: SourceOfTruth?
    var blocked = false
    var creditAt: Date?
    var creditTimer: Timer?
    var collectTimer: Timer?
    var creditBusy = false
    var collectBusy = false
    let alarms = Alarms()
    var alarmTimer: Timer?
    var lastClosedAt = Date.distantPast

    static let creditInterval: TimeInterval = 60
    static let collectInterval: TimeInterval = 20

    // MARK: menu bar

    private func renderTitle() {
        guard let b = item?.button else { return }
        let font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        // A figure older than 10 minutes means the last call failed; grey it.
        let stale = creditAt.map { Date().timeIntervalSince($0) > 600 } ?? true
        var text = " …"
        var color: NSColor = .tertiaryLabelColor
        if blocked {
            text = "⛔︎ VPN"
        } else if let remaining = truth?.credit?.remaining {
            text = String(format: "$%.2f", remaining)
            color = stale ? .tertiaryLabelColor
                : remaining < 2 ? .systemRed
                : remaining < 5 ? .systemOrange : .labelColor
        }
        b.attributedTitle = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color])
    }

    // MARK: popover

    @objc private func togglePopover() {
        guard let button = item.button else { return }
        if popover.isShown {
            popover.performClose(nil)
            return
        }
        // A transient popover closes on the same click that lands on the status
        // button; without this guard the action would immediately reopen it.
        if Date().timeIntervalSince(lastClosedAt) < 0.25 { return }
        panel.render(truth: truth)
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    }

    // MARK: data

    @objc func refreshNow() {
        Task { await refreshAll() }
    }

    private func apply(_ r: RefreshResult) {
        if let t = r.truth { truth = t }
        blocked = (r.state == .blockedNoVPN)
        if let c = r.creditAt { creditAt = c }
        renderTitle()
        panel?.render(truth: truth)
    }

    private func refreshAll() async {
        await refreshCredit()
        await collect()
    }

    private func refreshCredit() async {
        guard !creditBusy else { return }
        creditBusy = true
        defer { creditBusy = false }
        apply(await collector.refreshCredit())
    }

    private func collect() async {
        guard !collectBusy else { return }
        collectBusy = true
        defer { collectBusy = false }
        apply(await collector.collect())
    }

    private func startTimers() {
        let c = Timer(timeInterval: Self.creditInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refreshCredit() }
        }
        c.tolerance = 5
        RunLoop.main.add(c, forMode: .common)
        creditTimer = c

        let k = Timer(timeInterval: Self.collectInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.collect() }
        }
        k.tolerance = 2
        RunLoop.main.add(k, forMode: .common)
        collectTimer = k
    }

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
        item.button?.target = self
        item.button?.action = #selector(togglePopover)
        renderTitle()

        panel = PanelView(frame: NSRect(x: 0, y: 0, width: PanelView.width, height: 220))
        panel.onRefresh = { [weak self] in self?.refreshNow() }
        panel.onQuit = { NSApp.terminate(nil) }
        panel.onResize = { [weak self] size in self?.popover.contentSize = size }

        let controller = NSViewController()
        controller.view = panel
        popover = NSPopover()
        popover.behavior = .transient
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.animates = true
        popover.delegate = self
        popover.contentViewController = controller
        popover.contentSize = panel.preferredSize

        panel.render(truth: truth)
        startTimers()

        // Without a delegate macOS files notifications silently whenever it
        // counts this app as frontmost: no banner, no sound.
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let t = Timer(timeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.alarms.tick() }
        }
        t.tolerance = 1
        RunLoop.main.add(t, forMode: .common)
        alarmTimer = t
        alarms.tick()

        Task { await refreshAll() }
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
    nonisolated func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                            withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .list, .sound])
    }
}

extension AppDelegate: NSPopoverDelegate {
    nonisolated func popoverDidClose(_ notification: Notification) {
        MainActor.assumeIsolated { lastClosedAt = Date() }
    }
}
