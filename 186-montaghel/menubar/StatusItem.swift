import Cocoa

// Electron's Tray does not place an NSStatusItem on this machine (macOS 26.5):
// the item is created but never lands on the menu bar. So the menu bar item is
// native, exactly like CryptoMenuBar.app, and the Electron panel only feeds it
// text through a file. Same trick, one direction each way:
//   status.json   <- written by Electron, read here (the title)
//   command.json  -> written here, watched by Electron (clicks)

let support = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/claude-usage-bar")
let statusURL = support.appendingPathComponent("status.json")
let commandURL = support.appendingPathComponent("command.json")

final class Controller: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    var timer: Timer?

    func applicationDidFinishLaunching(_ n: Notification) {
        if let icon = NSImage(contentsOfFile: Bundle.main.bundlePath + "/Contents/Resources/trayTemplate.png") {
            icon.isTemplate = true
            icon.size = NSSize(width: 15, height: 15)
            item.button?.image = icon
            item.button?.imagePosition = .imageLeading
        }
        item.button?.title = " …"
        item.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular)
        item.button?.target = self
        item.button?.action = #selector(clicked)
        item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in self.reload() }
        reload()
        Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { _ in
            let f = self.item.button?.window?.frame ?? .zero
            let vis = self.item.isVisible
            let line = "[swift] visible=\(vis) frame=\(f) len=\(self.item.length) screens=\(NSScreen.screens.map{$0.frame})\n"
            FileHandle.standardError.write(line.data(using: .utf8)!)
        }
    }

    func reload() {
        guard let data = try? Data(contentsOf: statusURL),
              let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { item.button?.title = " –"; return }
        let title = (j["title"] as? String) ?? "–"
        let critical = (j["critical"] as? Bool) ?? false
        let attr = NSMutableAttributedString(string: title)
        if critical {
            attr.addAttribute(.foregroundColor, value: NSColor.systemRed,
                              range: NSRange(location: 0, length: attr.length))
        }
        attr.addAttribute(.font, value: NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular),
                          range: NSRange(location: 0, length: attr.length))
        item.button?.attributedTitle = attr
    }

    @objc func clicked() {
        let ev = NSApp.currentEvent
        let right = ev?.type == .rightMouseUp || ev?.modifierFlags.contains(.control) == true
        send(right ? "menu" : "toggle")
    }

    func send(_ cmd: String) {
        let payload: [String: Any] = ["cmd": cmd, "at": Date().timeIntervalSince1970]
        if let d = try? JSONSerialization.data(withJSONObject: payload) {
            try? d.write(to: commandURL)
        }
    }
}

let app = NSApplication.shared
let c = Controller()
app.delegate = c
app.setActivationPolicy(.accessory)
app.run()
