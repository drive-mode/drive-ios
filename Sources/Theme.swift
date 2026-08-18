import SwiftUI

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: alpha)
    }
}

/// Drive tokens — aliases the Hub variables in
/// cline-drivecode/docs/drivecode/design/brand/MOBILE-BRAND-STYLING.md
enum DT {
    static let violet = Color(hex: 0x9F58FA)
    static let violetHi = Color(hex: 0xAC6BFF)
    static let violetDeep = Color(hex: 0x8B45E8)
    static let danger = Color(hex: 0xF53969)

    static let pageLight = Color(hex: 0xF8FAFB)
    static let pageDark = Color(hex: 0x0A0A0A)
    static let well = Color(hex: 0x0D0D10)
    static let raised = Color(hex: 0x12131A)
    static let surface2Dark = Color(hex: 0x1B1D24)
    static let surface2Light = Color(hex: 0xF4F5F7)
    static let inkLight = Color(hex: 0x151516)
    static let diffGreenOnLight = Color(hex: 0x178C15)

    static let rControl: CGFloat = 9
    static let rCard: CGFloat = 13.5
    static let rHero: CGFloat = 16

    static let heroGradient = LinearGradient(
        colors: [violetHi, violet, violetDeep],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    static func page(_ s: ColorScheme) -> Color { s == .dark ? pageDark : pageLight }
    static func surface(_ s: ColorScheme) -> Color { s == .dark ? raised : .white }
    static func surface2(_ s: ColorScheme) -> Color { s == .dark ? surface2Dark : surface2Light }
    static func ink(_ s: ColorScheme) -> Color { s == .dark ? .white : inkLight }
    static func ink78(_ s: ColorScheme) -> Color { ink(s).opacity(0.78) }
    static func ink55(_ s: ColorScheme) -> Color { ink(s).opacity(0.55) }
    static func ink35(_ s: ColorScheme) -> Color { ink(s).opacity(0.35) }
    static func hairline(_ s: ColorScheme) -> Color { s == .dark ? .white.opacity(0.10) : inkLight.opacity(0.08) }
    static func violetText(_ s: ColorScheme) -> Color { s == .dark ? Color(hex: 0xB98AFF) : Color(hex: 0x7A3FD4) }
    static func live(_ s: ColorScheme) -> Color { s == .dark ? Color(hex: 0x4ADE80) : Color(hex: 0x2BCC28) }
}

struct CardStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    var radius: CGFloat = DT.rCard
    func body(content: Content) -> some View {
        content
            .background(DT.surface(scheme))
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
            // Soft depth is a documented mobile-light exception; dark stays ladder + hairline.
            .shadow(color: scheme == .dark ? .clear : DT.inkLight.opacity(0.04), radius: 3, y: 1)
    }
}

extension View {
    func card(radius: CGFloat = DT.rCard) -> some View { modifier(CardStyle(radius: radius)) }
}
