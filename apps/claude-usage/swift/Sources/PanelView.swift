import SwiftUI

/// Panel view in the OLD 186 app's visual language (Habib, 23 Nov 2026 17:56 and 18:26:
/// two screenshots — "this is a sample"), and **English-only text** (Habib 18:28:
/// "کلا فارسی نباشه توش"). Reference: `git show b6b2c52^:swift/Sources/PanelView.swift`.
/// Rules: continuous rows (no card per model) · 9pt dim label · 13pt rounded coloured
/// percent · 3pt hairline bar · thresholds on **used**: ≥90 red, ≥70 amber, else green.
final class UsageStore: ObservableObject {
    @Published var oc: OpenCode.Snapshot?
    @Published var or: OpenRouter.Snapshot?
    @Published var ocTick: Bool
    @Published var orTick: Bool
    var onTickChanged: (() -> Void)?

    init() {
        ocTick = UsagePanelController.tickValue(UsagePanelController.ocTickKey)
        orTick = UsagePanelController.tickValue(UsagePanelController.orTickKey)
    }

    func set(oc: OpenCode.Snapshot?, or: OpenRouter.Snapshot?) {
        self.oc = oc
        self.or = or
    }

    func toggleOC() {
        ocTick.toggle()
        UserDefaults.standard.set(ocTick, forKey: UsagePanelController.ocTickKey)
        onTickChanged?()
    }

    func toggleOR() {
        orTick.toggle()
        UserDefaults.standard.set(orTick, forKey: UsagePanelController.orTickKey)
        onTickChanged?()
    }
}

// MARK: - Primitives
private func vazir(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    if NSFont(name: "Vazirmatn", size: size) != nil {
        return .custom("Vazirmatn", size: size).weight(weight)
    }
    return .system(size: size, weight: weight)
}

private func T(_ s: String, _ size: CGFloat, _ weight: Font.Weight = .regular) -> Text {
    Text(s).font(vazir(size, weight))
}

/// Reference thresholds, on **used percent**: ≥90 red · ≥70 amber · else green.
private func colorForUsed(_ used: Double) -> Color {
    if used >= 90 { return .red }
    if used >= 70 { return .orange }
    return .green
}

/// Reference hairline bar: 3pt tall, width = used percent.
private struct Hairline: View {
    let used: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.10))
                Capsule().fill(colorForUsed(used))
                    .frame(width: max(1.5, geo.size.width * min(1, max(0, used / 100))))
            }
        }
        .frame(height: 3)
    }
}

/// One reference row: label + coloured percent + hairline + detail line.
private struct MetricRow: View {
    let label: String
    /// عددی که نشان داده می‌شود (درصدِ مصرف؛ برای «مانده» درصدِ مانده).
    let used: Double
    /// کسری که نوار پر می‌کند و رنگ از آن می‌آید؛ تهی ⇒ همان `used`.
    /// بدونِ این، ردیفِ «Credit left ۴٪» نوارِ ۹۶٪ می‌گرفت (سنجیده ۲۳ نوامبر ۱۸:۴۷).
    var barUsed: Double? = nil
    var detail: String? = nil

    var body: some View {
        let fill = barUsed ?? used
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                T(label, 9, .medium).foregroundStyle(.secondary)
                Spacer()
                Text(String(format: "%.0f%%", used))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(colorForUsed(fill))
            }
            Hairline(used: fill)
            if let detail {
                Text(detail)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}

// MARK: - OpenCode tab
private struct OpenCodeTab: View {
    @ObservedObject var store: UsageStore

    private func clock(_ iso: String?) -> String {
        guard let iso, iso.count >= 16 else { return "" }
        return String(iso.dropFirst(11).prefix(5))
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if let oc = store.oc {
                    group("Limits") {
                        MetricRow(label: "Session", used: oc.rolling ?? 0)
                        MetricRow(label: "Weekly", used: oc.weekly ?? 0)
                        MetricRow(label: "Monthly", used: oc.monthly ?? 0)
                    }
                    group("Models") {
                        ForEach(oc.models.filter { $0.cap > 0 || $0.spent > 0 }, id: \.id) { model in
                            MetricRow(label: model.name,
                                      used: model.used,
                                      detail: "$" + String(format: "%.2f", model.spent)
                                              + " of $" + String(format: "%.0f", model.cap))
                        }
                        let idle = oc.models.filter { $0.cap == 0 && $0.spent == 0 }
                        if !idle.isEmpty {
                            T(idle.count == 1 ? "1 idle model hidden"
                                              : "\(idle.count) idle models hidden", 10)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if !oc.folderGroups.isEmpty {
                        group("Folders (month)") {
                            ForEach(Array(oc.folderGroups.prefix(4).enumerated()), id: \.offset) { _, folder in
                                folderRow(folder)
                                ForEach(Array(folder.chats.prefix(3).enumerated()), id: \.offset) { _, chat in
                                    chatRow(chat)
                                }
                                if folder.chats.count > 3 {
                                    T("+\(folder.chats.count - 3) more chats", 9)
                                        .foregroundStyle(.tertiary)
                                        .padding(.leading, 10)
                                }
                            }
                        }
                    }
                    if oc.unknownRequests > 0 {
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 6) {
                                Image(systemName: "questionmark.circle").foregroundStyle(.orange)
                                T("Unattributed (before tracking)", 10, .medium)
                                Spacer()
                                Text("$" + String(format: "%.2f", oc.unknownCost))
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            }
                            HStack {
                                Spacer()
                                Text("\(oc.unknownRequests) req")
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                } else {
                    T("—", 12).foregroundStyle(.secondary)
                }
            }
            .padding(14)
        }
    }

    /// سرِ فولدر: مسیرِ دو بخشِ آخر + جمعِ فولدر + شمارِ چت‌ها.
    private func folderRow(_ folder: OpenCode.FolderGroup) -> some View {
        HStack(spacing: 6) {
            T(folder.label.split(separator: "/").suffix(2).joined(separator: "/"), 10, .semibold)
                .lineLimit(1)
            Spacer()
            Text("$" + String(format: "%.2f", folder.cost))
                .font(.system(size: 10, weight: .medium, design: .monospaced))
            Text(folder.chats.count == 1 ? "· 1 chat" : "· \(folder.chats.count) chats")
                .font(.system(size: 9, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .padding(.top, 4)
    }

    /// یک چت زیرِ فولدرش: اسم (نه شناسه)، جمع، و زیرش شکستِ هزینه مدل‌به‌مدل + شمارِ درخواست.
    private func chatRow(_ chat: OpenCode.ChatCost) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 6) {
                T(chat.title.isEmpty ? "chat " + clock(chat.first) : chat.title, 10, .medium)
                    .lineLimit(1)
                Spacer()
                Text("$" + String(format: "%.2f", chat.cost))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
            }
            HStack(spacing: 6) {
                T(chat.models.prefix(2)
                    .map { "\($0.name) " + String(format: "$%.2f", $0.cost) }
                    .joined(separator: " · "), 9)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                Text("\(chat.requests) req")
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.leading, 10)
        .padding(.vertical, 1)
    }

    private func group<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            T(title, 9, .semibold).foregroundStyle(.secondary).padding(.top, 6)
            content()
        }
    }
}

// MARK: - OpenRouter tab
private struct OpenRouterTab: View {
    @ObservedObject var store: UsageStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                if let or = store.or {
                    HStack(alignment: .firstTextBaseline) {
                        T("Today", 9, .medium).foregroundStyle(.secondary)
                        Spacer()
                        Text("$" + String(format: "%.2f", or.todaySpend))
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                        Text("\(or.todayRequests) req").font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    if let left = or.creditRemaining, let total = or.creditTotal, total > 0 {
                        MetricRow(label: "Credit left",
                                  used: 100 * left / total,
                                  barUsed: 100 * (total - left) / total,
                                  detail: "$" + String(format: "%.2f", left)
                                          + " of $" + String(format: "%.2f", total))
                    }
                    if !or.folders.isEmpty {
                        T("Folders", 9, .semibold).foregroundStyle(.secondary).padding(.top, 6)
                        ForEach(Array(or.folders.prefix(10).enumerated()), id: \.offset) { _, folder in
                            HStack {
                                T(folder.name, 10, .semibold).lineLimit(1)
                                Spacer()
                                Text("$" + String(format: "%.2f", folder.cost))
                                    .font(.system(size: 10, design: .monospaced))
                                Text(folder.chatCount == 1 ? "· 1 chat" : "· \(folder.chatCount) chats")
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.top, 4)
                            ForEach(Array(folder.chats.prefix(3).enumerated()), id: \.offset) { _, chat in
                                HStack {
                                    T(chat.title.isEmpty ? "chat" : chat.title, 10).lineLimit(1)
                                    Spacer()
                                    Text("$" + String(format: "%.2f", chat.cost))
                                        .font(.system(size: 10, design: .monospaced))
                                }
                                .padding(.leading, 10)
                                if !chat.children.isEmpty {
                                    // شکست از خودِ داده (Compaction · Hads · Agents …) — ساخته نمی‌شود.
                                    T(chat.children.prefix(3)
                                        .map { "\($0.label) " + String(format: "$%.2f", $0.cost) }
                                        .joined(separator: " · "), 9)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                        .padding(.leading, 20)
                                }
                            }
                        }
                    }
                } else {
                    T("—", 12).foregroundStyle(.secondary)
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Root
struct UsageRootView: View {
    @ObservedObject var store: UsageStore
    var onRefresh: () -> Void = {}
    var onClose: () -> Void = {}

    var body: some View {
        TabView {
            OpenCodeTab(store: store).tabItem { Text("OpenCode") }
            OpenRouterTab(store: store).tabItem { Text("OpenRouter") }
        }
        .padding(.top, 8)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 12) {
                Toggle("OpenCode in menu bar", isOn: Binding(get: { store.ocTick }, set: { _ in store.toggleOC() }))
                    .toggleStyle(.checkbox)
                Toggle("OpenRouter in menu bar", isOn: Binding(get: { store.orTick }, set: { _ in store.toggleOR() }))
                    .toggleStyle(.checkbox)
                Spacer()
                Button("Refresh", action: onRefresh)
                Button("Close", action: onClose)
            }
            .font(vazir(10))
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
        }
    }
}
