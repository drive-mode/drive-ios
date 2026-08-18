import SwiftUI

struct OpenView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(spacing: 0) {
            PreviewChip()
                .padding(.top, 24)

            Spacer()

            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(DT.surface(scheme))
                .frame(width: 96, height: 96)
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                .shadow(color: DT.inkLight.opacity(scheme == .dark ? 0 : 0.08), radius: 14, y: 5)
                .overlay {
                    DriveMark()
                        .foregroundStyle(DT.ink(scheme))
                        .frame(width: 54, height: 54)
                        .markWiggle()
                }

            Text("DRIVE")
                .font(.system(size: 12, weight: .bold))
                .tracking(4.5)
                .foregroundStyle(DT.ink55(scheme))
                .padding(.top, 20)

            VStack(spacing: 0) {
                Text("Talk to your")
                Text("codebase").foregroundStyle(DT.violetText(scheme))
            }
            .font(.system(size: 34, weight: .heavy))
            .kerning(-1.2)
            .padding(.top, 10)

            Text("Watch agents ship while you steer —\nhold to talk, approve every edit.")
                .font(.system(size: 15))
                .foregroundStyle(DT.ink55(scheme))
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.top, 14)

            Button {
                if store.hasLiveSession {
                    store.joinCall()
                } else {
                    store.launched = true
                    store.selectedTab = .home
                }
            } label: {
                Text(store.hasLiveSession ? "Watch a live session" : "Open Drive")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(DT.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                    .shadow(color: DT.violet.opacity(0.35), radius: 14, y: 8)
            }
            .buttonStyle(Pressable())
            .padding(.top, 34)

            Button {
                store.launched = true
            } label: {
                Text("Continue with Apple")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(DT.ink(scheme))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(DT.surface(scheme))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
                        .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .padding(.top, 12)

            Text("I have an invite link")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(DT.violetText(scheme))
                .padding(.top, 18)

            Spacer()

            HonestyDots()
                .padding(.bottom, 10)
        }
        .padding(.horizontal, 36)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            LinearGradient(colors: [scheme == .dark ? DT.pageDark : Color(hex: 0xFBFAFE), DT.page(scheme)],
                           startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
        }
    }
}
