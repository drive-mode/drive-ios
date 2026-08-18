import SwiftUI

/// The inbox: your fleet's asks and the product's news in one managed
/// stream. Swipe to read/unread, archive, delete; act on approvals inline;
/// filter by voice. Mail habits, Drive verbs.
struct InboxView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var filter = "All"
    @State private var unreadOnly = false

    private var items: [InboxItem] {
        store.inbox.filter { item in
            if filter == "Archived" { return item.archived }
            if item.archived { return false }
            if unreadOnly && item.read { return false }
            switch filter {
            case "For you": return !item.kind.isProduct
            case "Product": return item.kind.isProduct
            default: return true
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            filterBar.padding(.horizontal, 20).padding(.top, 8)
            if items.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "tray")
                        .font(.system(size: 30, weight: .light))
                        .foregroundStyle(DT.ink35(scheme))
                    Text(filter == "Archived" ? "Nothing archived" : "Inbox zero — nicely done")
                        .font(.system(size: 14, weight: .bold))
                    Text("Asks, invitations, ships, and product news land here.")
                        .font(.system(size: 12))
                        .foregroundStyle(DT.ink55(scheme))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(items) { item in
                        InboxRow(item: item)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    store.markInbox(item.id, read: !item.read)
                                } label: {
                                    Label(item.read ? "Unread" : "Read",
                                          systemImage: item.read ? "envelope.badge" : "envelope.open")
                                }
                                .tint(DT.violet)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    store.deleteInbox(item.id)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                Button {
                                    store.archiveInbox(item.id, !item.archived)
                                } label: {
                                    Label(item.archived ? "Restore" : "Archive",
                                          systemImage: item.archived ? "tray.and.arrow.up" : "archivebox")
                                }
                                .tint(Color(hex: 0x5B8DEF))
                            }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Inbox")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.intent.record(.inbox) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if store.unreadInboxCount > 0 {
                    Button {
                        for item in store.inbox where !item.read {
                            store.markInbox(item.id, read: true)
                        }
                    } label: {
                        Text("Read all")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(DT.violetText(scheme))
                    }
                }
            }
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(["All", "For you", "Product", "Archived"], id: \.self) { option in
                    let selected = filter == option
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { filter = option }
                    } label: {
                        Text(option)
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(selected ? .white : DT.ink78(scheme))
                            .padding(.horizontal, 13).padding(.vertical, 8)
                            .background(selected ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(selected ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                }
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { unreadOnly.toggle() }
                } label: {
                    HStack(spacing: 5) {
                        Circle().fill(unreadOnly ? .white : DT.violet).frame(width: 6, height: 6)
                        Text("Unread")
                            .font(.system(size: 12.5, weight: .bold))
                    }
                    .foregroundStyle(unreadOnly ? .white : DT.ink78(scheme))
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(unreadOnly ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(unreadOnly ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(.horizontal, -20)
        .contentMargins(.horizontal, 20, for: .scrollContent)
    }
}

struct InboxRow: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let item: InboxItem

    private var interrupt: Interrupt? {
        guard let id = item.interruptId else { return nil }
        return store.interrupts.first { $0.id == id }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 11) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: item.kind.symbol)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(item.kind.tint)
                        .frame(width: 34, height: 34)
                        .background(item.kind.tint.opacity(0.13))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    if !item.read {
                        Circle().fill(DT.violet)
                            .frame(width: 8, height: 8)
                            .offset(x: 3, y: -3)
                    }
                }
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(item.title)
                            .font(.system(size: 14, weight: item.read ? .semibold : .heavy))
                            .foregroundStyle(DT.ink(scheme))
                            .lineLimit(1)
                        Spacer()
                        Text(item.age)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    Text(item.body)
                        .scaledFont(12.5)
                        .foregroundStyle(DT.ink55(scheme))
                        .lineSpacing(2)
                        .lineLimit(3)
                }
            }

            if let interrupt, !interrupt.resolved {
                actionRow(interrupt).padding(.top, 11).padding(.leading, 45)
            } else if item.kind == .invite && !item.archived {
                HStack(spacing: 9) {
                    inboxButton("Join session", solid: true) {
                        store.markInbox(item.id, read: true)
                        store.joinCall()
                    }
                    inboxButton("Later", solid: false) {
                        store.archiveInbox(item.id)
                    }
                }
                .padding(.top, 11).padding(.leading, 45)
            }
        }
        .padding(13)
        .background(DT.surface(scheme).opacity(item.read ? 0.62 : 1))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(!item.read ? item.kind.tint.opacity(0.28) : DT.hairline(scheme), lineWidth: 0.8))
        .contentShape(Rectangle())
        .onTapGesture { store.markInbox(item.id, read: !item.read) }
        .contextMenu {
            Button { store.markInbox(item.id, read: !item.read) } label: {
                Label(item.read ? "Mark unread" : "Mark read",
                      systemImage: item.read ? "envelope.badge" : "envelope.open")
            }
            Button { store.archiveInbox(item.id, !item.archived) } label: {
                Label(item.archived ? "Restore" : "Archive", systemImage: "archivebox")
            }
            Button(role: .destructive) { store.deleteInbox(item.id) } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.read ? "" : "Unread. ")\(item.title). \(item.body)")
        .accessibilityHint("Tap to toggle read. Swipe for archive and delete.")
    }

    @ViewBuilder
    private func actionRow(_ interrupt: Interrupt) -> some View {
        if interrupt.kind == .approval {
            HStack(spacing: 9) {
                inboxButton("Deny", solid: false) {
                    store.denyEdit()
                    store.markInbox(item.id, read: true)
                }
                inboxButton("Allow", solid: true) {
                    store.allowEdit()
                    store.markInbox(item.id, read: true)
                }
            }
        } else {
            NavigationLink { InterruptConversationView(interruptId: interrupt.id) } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrowshape.turn.up.left")
                        .font(.system(size: 11, weight: .semibold))
                    Text("Reply to \(interrupt.agentName)")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(height: 38)
                .padding(.horizontal, 16)
                .background(DT.heroGradient)
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            }
            .buttonStyle(Pressable())
            .simultaneousGesture(TapGesture().onEnded { store.markInbox(item.id, read: true) })
        }
    }

    private func inboxButton(_ label: String, solid: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(solid ? .white : DT.ink78(scheme))
                .frame(height: 38)
                .padding(.horizontal, 18)
                .background(solid ? AnyShapeStyle(DT.heroGradient) : AnyShapeStyle(DT.surface2(scheme)))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
        }
        .buttonStyle(Pressable())
    }
}
