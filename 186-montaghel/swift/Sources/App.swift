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
    var truth: SourceOfTruth?
    var blocked = false
    var creditAt: Date?
    var creditTimer: Timer?
    var collectTimer: Timer?
    var creditBusy = false
    var collectBusy = false
    let alarms = Alarms()
    var alarmTimer: Timer?

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

    // MARK: menu

    private func money(_ v: Double) -> String { String(format: "$%.2f", v) }

    private func disabled(_ title: String) -> NSMenuItem {
        let i = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        i.isEnabled = false
        return i
    }

    /// A folder/chat row that only opens a submenu must stay enabled; AppKit
    /// refuses to open the submenu of a disabled item.
    private func node(_ title: String) -> NSMenuItem {
        let i = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        i.isEnabled = true
        return i
    }

    private func rebuildMenu() {
        let m = NSMenu()
        m.autoenablesItems = false
        if blocked {
            m.addItem(disabled("⛔ VPN — OpenRouter unreachable"))
        } else if let t = truth {
            m.addItem(disabled("OpenRouter credit  \(t.credit.map { money($0.remaining) } ?? "$—")"))
            let approx = t.approximate == true ? "  (approx)" : ""
            m.addItem(disabled("Today  \(money(t.today.spend)) · \(t.today.requests) requests\(approx)"))
            m.addItem(.separator())
            for f in t.folders {
                let folderItem = node("\(f.name)  \(money(f.cost))")
                let folderMenu = NSMenu()
                folderMenu.autoenablesItems = false
                for c in f.chats {
                    if c.children.isEmpty {
                        folderMenu.addItem(disabled((c.live ? "● " : "") + "\(c.title)  \(money(c.cost))"))
                        continue
                    }
                    let chatItem = node((c.live ? "● " : "") + "\(c.title)  \(money(c.cost))")
                    let chatMenu = NSMenu()
                    chatMenu.autoenablesItems = false
                    for ch in c.children {
                        let calls = ch.count > 0 ? " · \(ch.count)" : ""
                        chatMenu.addItem(disabled("\(ch.label)  \(money(ch.cost))\(calls)"))
                    }
                    chatItem.submenu = chatMenu
                    folderMenu.addItem(chatItem)
                }
                folderItem.submenu = folderMenu
                m.addItem(folderItem)
            }
        } else {
            m.addItem(disabled("Loading…"))
        }
        m.addItem(.separator())
        let refresh = NSMenuItem(title: "Refresh", action: #selector(refreshNow), keyEquivalent: "r")
        refresh.target = self
        m.addItem(refresh)
        m.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        item.menu = m
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
        rebuildMenu()
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
        renderTitle()
        rebuildMenu()
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
