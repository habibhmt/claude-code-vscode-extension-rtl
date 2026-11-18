import AppKit

// MARK: - Small view helpers

/// A label that never eats a click, so the row underneath receives it.
final class RowLabel: NSTextField {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

/// A row that runs a closure on click.
final class ClickRow: NSView {
    var onClick: (() -> Void)?
    override func mouseDown(with event: NSEvent) { onClick?() }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func resetCursorRects() {
        if onClick != nil { addCursorRect(bounds, cursor: .pointingHand) }
    }
}

/// Scroll document view: origin at the top-left, so content starts at the top.
final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}

/// A 0.5 px hairline separator.
final class HairlineView: NSView {
    init(color: NSColor = NSColor.white.withAlphaComponent(0.10)) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        wantsLayer = true
        layer?.backgroundColor = color.cgColor
        heightAnchor.constraint(equalToConstant: 0.5).isActive = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// One metric: title on the left, a bold tabular value on the right and an
/// optional 4 px progress bar underneath.
@MainActor
final class MetricRow: NSView {
    init(title: String, value: String, fraction: Double?, color: NSColor) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = RowLabel(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 11)
        titleLabel.textColor = .secondaryLabelColor
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.maximumNumberOfLines = 1
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)

        let valueLabel = RowLabel(labelWithString: value)
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 15, weight: .semibold)
        valueLabel.textColor = .labelColor
        valueLabel.alignment = .right
        valueLabel.maximumNumberOfLines = 1
        valueLabel.translatesAutoresizingMaskIntoConstraints = false
        valueLabel.setContentHuggingPriority(.required, for: .horizontal)
        valueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
        addSubview(valueLabel)

        let hasBar = fraction != nil
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: hasBar ? 26 : 18),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: topAnchor, constant: 9),
            valueLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
            valueLabel.firstBaselineAnchor.constraint(equalTo: titleLabel.firstBaselineAnchor),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: valueLabel.leadingAnchor, constant: -8),
        ])

        guard let fraction = fraction else { return }

        let track = NSView()
        track.translatesAutoresizingMaskIntoConstraints = false
        track.wantsLayer = true
        track.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.14).cgColor
        track.layer?.cornerRadius = 2
        addSubview(track)

        let fill = NSView()
        fill.translatesAutoresizingMaskIntoConstraints = false
        fill.wantsLayer = true
        fill.layer?.backgroundColor = color.cgColor
        fill.layer?.cornerRadius = 2
        fill.isHidden = fraction <= 0
        track.addSubview(fill)

        let clamped = min(max(fraction, 0.0001), 1)
        NSLayoutConstraint.activate([
            track.leadingAnchor.constraint(equalTo: leadingAnchor),
            track.trailingAnchor.constraint(equalTo: trailingAnchor),
            track.bottomAnchor.constraint(equalTo: bottomAnchor),
            track.heightAnchor.constraint(equalToConstant: 4),
            fill.leadingAnchor.constraint(equalTo: track.leadingAnchor),
            fill.topAnchor.constraint(equalTo: track.topAnchor),
            fill.bottomAnchor.constraint(equalTo: track.bottomAnchor),
            fill.widthAnchor.constraint(equalTo: track.widthAnchor, multiplier: clamped),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - Panel

/// The popover content: a translucent dark card with metric rows, a scrollable
/// folder → chat → child tree and a footer.
@MainActor
final class PanelView: NSView {
    static let width: CGFloat = 320
    static let maxHeight: CGFloat = 560
    static let pad: CGFloat = 12
    static let contentWidth: CGFloat = width - pad * 2

    private static let folderHeight: CGFloat = 20
    private static let chatHeight: CGFloat = 17
    private static let childHeight: CGFloat = 15
    private static let treeSpacing: CGFloat = 2

    private static let blue = NSColor(srgbRed: 0x3b / 255, green: 0x82 / 255, blue: 0xf6 / 255, alpha: 1)

    private static let clock: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    var onRefresh: (() -> Void)?
    var onQuit: (() -> Void)?
    var onResize: ((NSSize) -> Void)?

    private(set) var preferredSize = NSSize(width: PanelView.width, height: 200)

    private let background = NSVisualEffectView()
    private let stack = NSStackView()
    private let metrics = NSStackView()
    private let scroll = NSScrollView()
    private let document = FlippedView()
    private let tree = NSStackView()
    private let footer = NSView()
    private var updatedLabel: RowLabel!
    private var scrollHeight: NSLayoutConstraint!

    private var truth: SourceOfTruth?
    private var treeNatural: CGFloat = 20

    // Expansion state survives every 20 s re-render.
    private var seenFolders: Set<String> = []
    private var seenChats: Set<String> = []
    private var expandedFolders: Set<String> = []
    private var expandedChats: Set<String> = []

    // MARK: init

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        appearance = NSAppearance(named: .darkAqua)

        background.translatesAutoresizingMaskIntoConstraints = false
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = 12
        background.layer?.masksToBounds = true
        background.layer?.borderWidth = 0.5
        background.layer?.borderColor = NSColor.white.withAlphaComponent(0.12).cgColor
        addSubview(background)

        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.orientation = .vertical
        stack.alignment = .width
        stack.spacing = 8
        addSubview(stack)

        metrics.orientation = .vertical
        metrics.alignment = .width
        metrics.spacing = 9

        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.scrollerStyle = .overlay
        scroll.verticalScrollElasticity = .none
        scroll.translatesAutoresizingMaskIntoConstraints = false

        document.addSubview(tree)
        tree.orientation = .vertical
        tree.alignment = .width
        tree.spacing = Self.treeSpacing
        scroll.documentView = document

        buildFooter()

        stack.addArrangedSubview(metrics)
        stack.addArrangedSubview(HairlineView())
        stack.addArrangedSubview(scroll)
        stack.addArrangedSubview(footer)

        scrollHeight = scroll.heightAnchor.constraint(equalToConstant: 1)
        scrollHeight.isActive = true

        NSLayoutConstraint.activate([
            background.leadingAnchor.constraint(equalTo: leadingAnchor),
            background.trailingAnchor.constraint(equalTo: trailingAnchor),
            background.topAnchor.constraint(equalTo: topAnchor),
            background.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Self.pad),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Self.pad),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: Self.pad),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -Self.pad),
        ])
    }

    private func buildFooter() {
        footer.translatesAutoresizingMaskIntoConstraints = false
        footer.heightAnchor.constraint(equalToConstant: 20).isActive = true

        updatedLabel = RowLabel(labelWithString: "")
        updatedLabel.font = .systemFont(ofSize: 10)
        updatedLabel.textColor = .tertiaryLabelColor
        updatedLabel.translatesAutoresizingMaskIntoConstraints = false
        footer.addSubview(updatedLabel)

        let refresh = styledButton("Refresh", action: #selector(refreshTapped))
        footer.addSubview(refresh)

        let quit = styledButton("Quit", action: #selector(quitTapped))
        footer.addSubview(quit)

        NSLayoutConstraint.activate([
            updatedLabel.leadingAnchor.constraint(equalTo: footer.leadingAnchor),
            updatedLabel.centerYAnchor.constraint(equalTo: footer.centerYAnchor),
            updatedLabel.trailingAnchor.constraint(lessThanOrEqualTo: refresh.leadingAnchor, constant: -8),
            quit.trailingAnchor.constraint(equalTo: footer.trailingAnchor),
            quit.centerYAnchor.constraint(equalTo: footer.centerYAnchor),
            refresh.trailingAnchor.constraint(equalTo: quit.leadingAnchor, constant: -12),
            refresh.centerYAnchor.constraint(equalTo: footer.centerYAnchor),
        ])
    }

    private func styledButton(_ title: String, action: Selector) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.isBordered = false
        b.attributedTitle = NSAttributedString(string: title, attributes: [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.secondaryLabelColor,
        ])
        b.translatesAutoresizingMaskIntoConstraints = false
        return b
    }

    @objc private func refreshTapped() { onRefresh?() }
    @objc private func quitTapped() { onQuit?() }

    // MARK: render

    func render(truth: SourceOfTruth?) {
        let saved = scroll.contentView.bounds.origin
        self.truth = truth
        rebuildMetrics()
        rebuildTree()
        updateFooter()
        applySizes()
        layoutSubtreeIfNeeded()
        scroll.contentView.scroll(to: saved)
        scroll.reflectScrolledClipView(scroll.contentView)
    }

    private func rebuildMetrics() {
        for v in metrics.arrangedSubviews {
            metrics.removeArrangedSubview(v)
            v.removeFromSuperview()
        }

        let credit = truth?.credit
        let remaining = credit?.remaining ?? 0
        let total = credit?.total ?? 0
        let used = credit?.used ?? 0

        let creditColor: NSColor
        if remaining < 2 {
            creditColor = .systemRed
        } else if remaining < 5 {
            creditColor = .systemOrange
        } else {
            creditColor = Self.blue
        }

        let creditValue = credit.map { String(format: "$%.2f", $0.remaining) } ?? "$—"
        let creditFraction = total > 0 ? used / total : 0
        metrics.addArrangedSubview(MetricRow(title: "Credit", value: creditValue,
                                             fraction: creditFraction, color: creditColor))

        let spend = truth?.today.spend ?? 0
        let todayTitle = truth?.approximate == true ? "Today (approx)" : "Today"
        let denominator = spend + remaining
        let todayFraction = denominator > 0 ? min(spend / denominator, 1) : 0
        metrics.addArrangedSubview(MetricRow(title: todayTitle,
                                             value: String(format: "$%.4f", spend),
                                             fraction: todayFraction, color: Self.blue))

        let requests = truth?.today.requests ?? 0
        metrics.addArrangedSubview(MetricRow(title: "Requests", value: "\(requests)",
                                             fraction: nil, color: Self.blue))
    }

    private func rebuildTree() {
        for v in tree.arrangedSubviews {
            tree.removeArrangedSubview(v)
            v.removeFromSuperview()
        }

        var total: CGFloat = 0
        var count = 0
        func add(_ v: NSView, _ height: CGFloat) {
            v.translatesAutoresizingMaskIntoConstraints = false
            v.heightAnchor.constraint(equalToConstant: height).isActive = true
            tree.addArrangedSubview(v)
            total += height
            count += 1
        }

        guard let t = truth, !t.folders.isEmpty else {
            add(placeholderRow(truth == nil ? "Loading…" : "No activity today"), Self.folderHeight)
            treeNatural = total
            return
        }

        for f in t.folders {
            // A folder with no cost and no chat is only noise from a stale
            // transcript touch today; it has nothing to show.
            guard f.cost > 0 || !f.chats.isEmpty else { continue }
            if !seenFolders.contains(f.id) {
                seenFolders.insert(f.id)
                if f.chats.count <= 6 { expandedFolders.insert(f.id) }
            }
            // A chat's children (Hads, Subagents) are the point of the panel,
            // so they start open instead of hiding behind a click.
            for c in f.chats where !c.children.isEmpty && !seenChats.contains(c.id) {
                seenChats.insert(c.id)
                expandedChats.insert(c.id)
            }
            let isOpen = expandedFolders.contains(f.id)
            add(folderRow(f, expanded: isOpen), Self.folderHeight)
            guard isOpen else { continue }
            for c in f.chats {
                let chatOpen = expandedChats.contains(c.id)
                add(chatRow(c, expanded: chatOpen), Self.chatHeight)
                guard chatOpen else { continue }
                for child in c.children {
                    add(childRow(child), Self.childHeight)
                }
            }
        }

        treeNatural = count > 1 ? total + Self.treeSpacing * CGFloat(count - 1) : total
    }

    // MARK: rows

    private func folderRow(_ f: FolderInfo, expanded: Bool) -> NSView {
        let row = ClickRow()

        let chevron = RowLabel(labelWithString: expanded ? "▾" : "▸")
        chevron.font = .systemFont(ofSize: 9)
        chevron.textColor = .tertiaryLabelColor
        chevron.translatesAutoresizingMaskIntoConstraints = false

        let name = RowLabel(labelWithString: f.name)
        name.font = .systemFont(ofSize: 12, weight: .semibold)
        name.textColor = .labelColor
        name.lineBreakMode = .byTruncatingMiddle
        name.maximumNumberOfLines = 1
        name.setContentHuggingPriority(.defaultLow, for: .horizontal)
        name.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        name.translatesAutoresizingMaskIntoConstraints = false

        let cost = RowLabel(labelWithString: money(f.cost))
        cost.font = .monospacedDigitSystemFont(ofSize: 11, weight: .semibold)
        cost.textColor = .secondaryLabelColor
        cost.alignment = .right
        cost.maximumNumberOfLines = 1
        cost.setContentHuggingPriority(.required, for: .horizontal)
        cost.setContentCompressionResistancePriority(.required, for: .horizontal)
        cost.translatesAutoresizingMaskIntoConstraints = false

        row.addSubview(chevron)
        row.addSubview(name)
        row.addSubview(cost)
        NSLayoutConstraint.activate([
            chevron.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            chevron.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            name.leadingAnchor.constraint(equalTo: chevron.trailingAnchor, constant: 4),
            name.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            name.trailingAnchor.constraint(lessThanOrEqualTo: cost.leadingAnchor, constant: -8),
            cost.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            cost.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        row.onClick = { [weak self] in self?.toggleFolder(f.id) }
        return row
    }

    private func chatRow(_ c: ChatInfo, expanded: Bool) -> NSView {
        let row = ClickRow()

        let dot = RowLabel(labelWithString: "●")
        dot.font = .systemFont(ofSize: 7)
        dot.textColor = c.live ? .systemGreen : NSColor.white.withAlphaComponent(0.18)
        dot.translatesAutoresizingMaskIntoConstraints = false

        let hasChildren = !c.children.isEmpty
        let triangle = RowLabel(labelWithString: hasChildren ? (expanded ? "▾" : "▸") : "")
        triangle.font = .systemFont(ofSize: 9)
        triangle.textColor = .tertiaryLabelColor
        triangle.translatesAutoresizingMaskIntoConstraints = false

        let title = RowLabel(labelWithString: c.title)
        title.font = .systemFont(ofSize: 11)
        title.textColor = .labelColor
        title.lineBreakMode = .byTruncatingMiddle
        title.maximumNumberOfLines = 1
        title.setContentHuggingPriority(.defaultLow, for: .horizontal)
        title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        title.translatesAutoresizingMaskIntoConstraints = false

        let cost = RowLabel(labelWithString: money(c.cost))
        cost.font = .monospacedDigitSystemFont(ofSize: 10, weight: .medium)
        cost.textColor = .secondaryLabelColor
        cost.alignment = .right
        cost.maximumNumberOfLines = 1
        cost.setContentHuggingPriority(.required, for: .horizontal)
        cost.setContentCompressionResistancePriority(.required, for: .horizontal)
        cost.translatesAutoresizingMaskIntoConstraints = false

        row.addSubview(dot)
        row.addSubview(triangle)
        row.addSubview(title)
        row.addSubview(cost)
        NSLayoutConstraint.activate([
            dot.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 12),
            dot.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            triangle.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 4),
            triangle.widthAnchor.constraint(equalToConstant: 9),
            triangle.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            title.leadingAnchor.constraint(equalTo: triangle.trailingAnchor, constant: 4),
            title.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            title.trailingAnchor.constraint(lessThanOrEqualTo: cost.leadingAnchor, constant: -8),
            cost.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            cost.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        row.onClick = hasChildren ? { [weak self] in self?.toggleChat(c.id) } : nil
        return row
    }

    private func childRow(_ child: ChildInfo) -> NSView {
        let row = ClickRow()

        let text = child.count > 0 ? "\(child.label) · \(child.count)" : child.label
        let label = RowLabel(labelWithString: text)
        label.font = .systemFont(ofSize: 10)
        label.textColor = .secondaryLabelColor
        label.lineBreakMode = .byTruncatingMiddle
        label.maximumNumberOfLines = 1
        label.setContentHuggingPriority(.defaultLow, for: .horizontal)
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        label.translatesAutoresizingMaskIntoConstraints = false

        let cost = RowLabel(labelWithString: money(child.cost))
        cost.font = .monospacedDigitSystemFont(ofSize: 10, weight: .regular)
        cost.textColor = .secondaryLabelColor
        cost.alignment = .right
        cost.maximumNumberOfLines = 1
        cost.setContentHuggingPriority(.required, for: .horizontal)
        cost.setContentCompressionResistancePriority(.required, for: .horizontal)
        cost.translatesAutoresizingMaskIntoConstraints = false

        row.addSubview(label)
        row.addSubview(cost)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 24),
            label.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            label.trailingAnchor.constraint(lessThanOrEqualTo: cost.leadingAnchor, constant: -8),
            cost.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            cost.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        return row
    }

    private func placeholderRow(_ text: String) -> NSView {
        let row = ClickRow()
        let label = RowLabel(labelWithString: text)
        label.font = .systemFont(ofSize: 11)
        label.textColor = .tertiaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 4),
            label.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ])
        return row
    }

    // MARK: toggles

    private func toggleFolder(_ id: String) {
        if expandedFolders.contains(id) {
            expandedFolders.remove(id)
        } else {
            expandedFolders.insert(id)
        }
        render(truth: truth)
    }

    private func toggleChat(_ id: String) {
        if expandedChats.contains(id) {
            expandedChats.remove(id)
        } else {
            expandedChats.insert(id)
        }
        render(truth: truth)
    }

    // MARK: sizing

    private func applySizes() {
        // 3 metric rows (26 + 9 + 26 + 9 + 18) and a 20 pt footer.
        let metricsHeight: CGFloat = 88
        let footerHeight: CGFloat = 20
        let hairline: CGFloat = 0.5
        let outerSpacing: CGFloat = 8 * 3
        let fixed = metricsHeight + footerHeight + hairline + outerSpacing + Self.pad * 2

        let maxScroll = Self.maxHeight - fixed
        let visible = min(max(treeNatural, 1), maxScroll)
        scrollHeight.constant = visible
        scroll.hasVerticalScroller = treeNatural > visible + 0.5

        let documentHeight = max(treeNatural, visible)
        document.frame = NSRect(x: 0, y: 0, width: Self.contentWidth, height: documentHeight)
        tree.frame = NSRect(x: 0, y: 0, width: Self.contentWidth, height: treeNatural)

        let size = NSSize(width: Self.width, height: fixed + visible)
        if size != preferredSize {
            preferredSize = size
            onResize?(size)
        }
        // The outer stack is pinned to all four edges, so the panel frame and the
        // content height must agree before AppKit starts laying out.
        frame = NSRect(origin: frame.origin, size: size)
    }

    // MARK: footer + formatting

    private func updateFooter() {
        guard let iso = truth?.updated, let date = ORTime.date(iso) else {
            updatedLabel.stringValue = "Updated —"
            return
        }
        updatedLabel.stringValue = "Updated " + Self.clock.string(from: date)
    }

    private func money(_ value: Double) -> String { String(format: "$%.2f", value) }
}
