import SwiftUI

/// Everything the agents produce — organized any way you think: by project,
/// repo, day, or type; filtered by kind, size, and lifespan; sorted in one
/// tap. Purpose decides lifespan: ephemeral artifacts carry a TTL and file
/// themselves into the archive; permanent ones keep until superseded.
struct ArtifactsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    @State private var kindFilter: ArtifactKind? = nil
    @State private var grouping = "Project"
    @State private var sizeBand = "Any size"
    @State private var lifeFilter = "Any life"
    @State private var sort = "Newest"

    // MARK: Pipeline — one pass over the gallery per body, not one per control

    private struct GalleryModel {
        var sections: [(header: String, items: [Artifact])] = []
        var kindCounts: [ArtifactKind: Int] = [:]
        var total = 0
        var visible = 0
    }

    private var model: GalleryModel {
        var out = GalleryModel()
        out.total = store.artifacts.count
        var items: [Artifact] = []
        items.reserveCapacity(out.total)
        for a in store.artifacts {
            out.kindCounts[a.kind, default: 0] += 1
            if let kindFilter, a.kind != kindFilter { continue }
            switch sizeBand {
            case "< 100 KB": if a.sizeKB >= 100 { continue }
            case "100 KB – 1 MB": if a.sizeKB < 100 || a.sizeKB >= 1024 { continue }
            case "> 1 MB": if a.sizeKB < 1024 { continue }
            default: break
            }
            switch lifeFilter {
            case "Permanent": if !a.life.isPermanent { continue }
            case "Ephemeral": if a.life.isPermanent { continue }
            default: break
            }
            items.append(a)
        }
        switch sort {
        case "Largest": items.sort { $0.sizeKB > $1.sizeKB }
        case "A–Z": items.sort { $0.title < $1.title }
        default: break // Newest = feed order
        }
        out.visible = items.count
        let key: ((Artifact) -> String)?
        switch grouping {
        case "Repo": key = { $0.repo }
        case "Day": key = { $0.day }
        case "Type": key = { $0.kind.rawValue + "s" }
        case "Project": key = { $0.room }
        default: key = nil
        }
        guard let key else {
            out.sections = [("", items)]
            return out
        }
        var order: [String] = []
        var buckets: [String: [Artifact]] = [:]
        for item in items {
            let k = key(item)
            if buckets[k] == nil { order.append(k) }
            buckets[k, default: []].append(item)
        }
        out.sections = order.map { ($0, buckets[$0] ?? []) }
        return out
    }

    var body: some View {
        let model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                kindChips(model).padding(.top, 8)
                controlBar.padding(.top, 10)

                ForEach(model.sections, id: \.header) { section in
                    if !section.header.isEmpty {
                        HStack {
                            Text(section.header)
                                .font(.system(size: 12, weight: .heavy))
                                .foregroundStyle(DT.ink55(scheme))
                            Spacer()
                            Text("\(section.items.count)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .padding(.top, 18)
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible())], spacing: 9) {
                        ForEach(section.items) { artifact in
                            NavigationLink { ArtifactDetailView(artifactId: artifact.id) } label: {
                                ArtifactCard(artifact: artifact)
                            }
                            .buttonStyle(Pressable())
                        }
                    }
                    .padding(.top, 9)
                }

                if model.visible == 0 {
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.system(size: 26, weight: .light))
                            .foregroundStyle(DT.ink35(scheme))
                        Text("Nothing matches those filters")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                }

                Text("Ephemeral artifacts file to the archive when their TTL passes — searchable, never deleted. Permanent ones keep until superseded.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 22)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Artifacts")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.intent.record(.artifacts) }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: grouping)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: sort)
    }

    // MARK: Controls

    private func kindChips(_ model: GalleryModel) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                chip(nil, label: "All · \(model.total)")
                ForEach(ArtifactKind.allCases, id: \.self) { kind in
                    if let count = model.kindCounts[kind], count > 0 {
                        chip(kind, label: "\(kind.rawValue) · \(count)")
                    }
                }
            }
        }
        .padding(.horizontal, -20)
        .contentMargins(.horizontal, 20, for: .scrollContent)
    }

    private func chip(_ kind: ArtifactKind?, label: String) -> some View {
        let selected = kindFilter == kind
        let tint = kind?.tint ?? DT.violet
        return Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { kindFilter = kind }
        } label: {
            HStack(spacing: 6) {
                if let kind {
                    Image(systemName: kind.symbol).font(.system(size: 10, weight: .semibold))
                }
                Text(label).font(.system(size: 12.5, weight: .bold))
            }
            .foregroundStyle(selected ? .white : DT.ink78(scheme))
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(selected ? AnyShapeStyle(tint) : AnyShapeStyle(DT.surface(scheme)))
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(selected ? .clear : DT.hairline(scheme), lineWidth: 0.8))
        }
        .buttonStyle(Pressable())
    }

    private var controlBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                menuPill(icon: "square.grid.2x2", selection: $grouping,
                         options: ["Project", "Repo", "Day", "Type", "None"], prefix: "By")
                menuPill(icon: "internaldrive", selection: $sizeBand,
                         options: ["Any size", "< 100 KB", "100 KB – 1 MB", "> 1 MB"], prefix: nil)
                menuPill(icon: "hourglass", selection: $lifeFilter,
                         options: ["Any life", "Permanent", "Ephemeral"], prefix: nil)
                menuPill(icon: "arrow.up.arrow.down", selection: $sort,
                         options: ["Newest", "Largest", "A–Z"], prefix: nil)
            }
        }
        .padding(.horizontal, -20)
        .contentMargins(.horizontal, 20, for: .scrollContent)
    }

    private func menuPill(icon: String, selection: Binding<String>, options: [String], prefix: String?) -> some View {
        Menu {
            Picker("", selection: selection) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 10, weight: .semibold))
                Text(prefix.map { "\($0) \(selection.wrappedValue.lowercased())" } ?? selection.wrappedValue)
                    .font(.system(size: 11.5, weight: .bold))
                Image(systemName: "chevron.down").font(.system(size: 8, weight: .bold))
            }
            .foregroundStyle(selection.wrappedValue.hasPrefix("Any") || selection.wrappedValue == "Newest" || selection.wrappedValue == "None"
                             ? DT.ink55(scheme) : DT.violetText(scheme))
            .padding(.horizontal, 11).padding(.vertical, 8)
            .background(DT.surface2(scheme))
            .clipShape(Capsule())
        }
    }
}

struct ArtifactCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let artifact: Artifact

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: artifact.kind.symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(artifact.kind.tint)
                    .frame(width: 30, height: 30)
                    .background(artifact.kind.tint.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Spacer()
                Text(artifact.age)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(DT.ink35(scheme))
            }
            Text(artifact.title)
                .font(.system(size: 13.5, weight: .bold))
                .foregroundStyle(DT.ink(scheme))
                .lineLimit(2, reservesSpace: true)
                .multilineTextAlignment(.leading)
                .padding(.top, 10)
            Text(artifact.meta)
                .font(.system(size: 10.5, design: .monospaced))
                .foregroundStyle(artifact.kind.tint)
                .lineLimit(1)
                .padding(.top, 3)
            HStack(spacing: 6) {
                AvatarChip(letter: String(artifact.agentName.prefix(1)), color: artifact.agentColor, size: 16)
                Text(artifact.room)
                    .font(.system(size: 10))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
            }
            .padding(.top, 9)
            HStack {
                Text(artifact.sizeLabel)
                    .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(DT.ink35(scheme))
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: artifact.life.symbol)
                        .font(.system(size: 8, weight: .bold))
                    Text(artifact.life.badge)
                        .font(.system(size: 9, weight: .heavy))
                }
                .foregroundStyle(artifact.life.isPermanent ? DT.ink55(scheme) : Color(hex: 0xFFC55C))
                .padding(.horizontal, 7).padding(.vertical, 3.5)
                .background(artifact.life.isPermanent ? AnyShapeStyle(DT.surface2(scheme))
                                                      : AnyShapeStyle(Color(hex: 0xFFC55C).opacity(0.13)))
                .clipShape(Capsule())
            }
            .padding(.top, 9)
        }
        .padding(12)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        .contextMenu {
            Button { store.joinCall() } label: { Label("Open in session", systemImage: "waveform") }
            ShareLink(item: "\(artifact.title) — \(artifact.meta) · \(artifact.room)") {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            Divider()
            if artifact.life.isPermanent {
                Button { store.setArtifactLife(artifact.id, .ephemeral(daysLeft: 7)) } label: {
                    Label("Make ephemeral · 7d", systemImage: "hourglass")
                }
                Button { store.setArtifactLife(artifact.id, .ephemeral(daysLeft: 30)) } label: {
                    Label("Make ephemeral · 30d", systemImage: "hourglass.bottomhalf.filled")
                }
            } else {
                Button { store.setArtifactLife(artifact.id, .permanent) } label: {
                    Label("Mark permanent", systemImage: "infinity")
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(artifact.kind.rawValue): \(artifact.title), \(artifact.room), \(artifact.sizeLabel), \(artifact.life.isPermanent ? "permanent" : "ephemeral, \(artifact.life.badge)")")
        .accessibilityHint("Opens the artifact. Long press for lifecycle options.")
    }
}

/// The Home rail — the freshest work products, one swipe deep.
struct ArtifactRail: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Eyebrow("ARTIFACTS")
                Spacer()
                NavigationLink { ArtifactsView() } label: {
                    HStack(spacing: 4) {
                        Text("All \(store.artifacts.count)")
                            .font(.system(size: 12, weight: .bold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(DT.violetText(scheme))
                }
                .buttonStyle(Pressable())
            }
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 9) {
                    ForEach(store.artifacts.prefix(6)) { artifact in
                        NavigationLink { ArtifactDetailView(artifactId: artifact.id) } label: {
                            railCard(artifact)
                        }
                        .buttonStyle(Pressable())
                    }
                }
            }
            .frame(height: 96)
            .padding(.top, 10)
            .padding(.horizontal, -20)
            .contentMargins(.horizontal, 20, for: .scrollContent)
        }
    }

    private func railCard(_ artifact: Artifact) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Image(systemName: artifact.kind.symbol)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(artifact.kind.tint)
                Text(artifact.kind.rawValue.uppercased())
                    .font(.system(size: 8.5, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(artifact.kind.tint)
                Spacer()
                if !artifact.life.isPermanent {
                    Image(systemName: "hourglass")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color(hex: 0xFFC55C))
                }
            }
            Text(artifact.title)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(DT.ink(scheme))
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            Text("\(artifact.room) · \(artifact.age)")
                .font(.system(size: 9.5))
                .foregroundStyle(DT.ink55(scheme))
                .lineLimit(1)
        }
        .padding(11)
        .frame(width: 168, alignment: .leading)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(artifact.kind.tint.opacity(0.22), lineWidth: 0.8))
    }
}
