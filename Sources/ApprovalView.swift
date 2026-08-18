import SwiftUI

/// The approval sheet is intentionally light even over the dark call —
/// per the locked artboard: sheet · one decision · clear code.
struct ApprovalView: View {
    @EnvironmentObject var store: AppStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(DT.inkLight.opacity(0.16))
                .frame(width: 38, height: 5)
                .frame(maxWidth: .infinity)
                .padding(.top, 10)

            Text("Approve change?")
                .font(.system(size: 26, weight: .heavy))
                .kerning(-0.8)
                .foregroundStyle(DT.inkLight)
                .padding(.top, 18)

            HStack(spacing: 5) {
                Text("Cline wants to edit").foregroundStyle(DT.inkLight.opacity(0.55))
                Text("auth.ts")
                    .font(.system(size: 12.5, design: .monospaced))
                    .foregroundStyle(DT.inkLight)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(DT.surface2Light)
                    .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            }
            .font(.system(size: 14))
            .padding(.top, 6)

            VStack(alignment: .leading, spacing: 5) {
                Text("+ export function requireAuth()")
                Text("+   verifyJwt(req)")
                Text("+   next()")
            }
            .font(.system(size: 12.5, design: .monospaced))
            .foregroundStyle(DT.diffGreenOnLight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 15).padding(.vertical, 13)
            .background(DT.surface2Light)
            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous)
                .strokeBorder(DT.inkLight.opacity(0.08), lineWidth: 0.8))
            .padding(.top, 16)

            HStack(spacing: 14) {
                HStack(spacing: 4) {
                    Text("+12").foregroundStyle(DT.diffGreenOnLight)
                    Text("−3").foregroundStyle(DT.danger)
                }
                Text("auth.ts")
                Text("branch drive/auth")
            }
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(DT.inkLight.opacity(0.35))
            .padding(.top, 10)

            HStack(spacing: 10) {
                Button { store.denyEdit() } label: {
                    Text("Deny")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(DT.inkLight)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(DT.surface2Light)
                        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                }
                .buttonStyle(Pressable())

                Button { store.allowEdit() } label: {
                    Text("Allow")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(DT.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                        .shadow(color: DT.violet.opacity(0.35), radius: 12, y: 6)
                }
                .buttonStyle(Pressable())
                .frame(maxWidth: .infinity)
            }
            .padding(.top, 20)

            Text("Nothing lands without you — every edit is yours to allow.")
                .font(.system(size: 11))
                .foregroundStyle(DT.inkLight.opacity(0.35))
                .frame(maxWidth: .infinity)
                .padding(.top, 14)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .background(Color.white.ignoresSafeArea())
        .environment(\.colorScheme, .light)
    }
}
