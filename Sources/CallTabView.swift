import SwiftUI

struct CallTabView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Eyebrow("IN SESSION").padding(.top, 8)
                    LiveHeroCard(expanded: true).padding(.top, 10)

                    Button { store.joinCall() } label: {
                        HStack(spacing: 9) {
                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                            Text("Start a session")
                                .font(.system(size: 15, weight: .bold))
                        }
                        .foregroundStyle(DT.violetText(scheme))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(DT.violet.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                            .strokeBorder(DT.violet.opacity(0.22), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                    .padding(.top, 12)

                    Eyebrow("EARLIER").padding(.top, 24)
                    ForEach(DemoData.recents) { room in
                        HStack(spacing: 12) {
                            Image(systemName: "waveform")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(DT.ink55(scheme))
                                .frame(width: 36, height: 36)
                                .background(DT.surface2(scheme))
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(room.title).font(.system(size: 15, weight: .semibold))
                                Text(room.subtitle).font(.system(size: 12)).foregroundStyle(DT.ink55(scheme))
                            }
                            Spacer()
                            Text("Replay")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(DT.violetText(scheme))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 13)
                        .card()
                        .padding(.top, 10)
                    }

                    Text("Sessions replay as their directed program — every beat, readable after the fact.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(DT.ink35(scheme))
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, 24)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .tabSwipe()
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Work")
        }
    }
}
