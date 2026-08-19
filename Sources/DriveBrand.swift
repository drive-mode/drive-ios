import SwiftUI
import UIKit

/// The single runtime entry point for Drive's official steering-wheel mark.
///
/// `Brand/DriveMarkSource.png` owns the locked geometry and generates the
/// runtime image plus app-icon appearances. This type owns its contrast rules
/// so feature views never select a logo asset or invent their own brand color.
enum DriveBrand {
    enum Contrast {
        /// Black in light appearances and white in dark appearances.
        case adaptive
        /// Force the dark silhouette for a known light container.
        case onLight
        /// Force the light silhouette for a known dark container.
        case onDark
    }

    static func foreground(for contrast: Contrast, colorScheme: ColorScheme) -> Color {
        switch contrast {
        case .adaptive:
            return colorScheme == .dark ? .white : .black
        case .onLight:
            return .black
        case .onDark:
            return .white
        }
    }

    /// UIKit-backed tab bars only extract `Image` and `Text` from `tabItem`.
    /// Render the canonical mark once as a template; UIKit then supplies the
    /// selected/unselected tint without introducing a second logo asset.
    @MainActor
    static let tabBarImage: UIImage = {
        let renderer = ImageRenderer(
            content: DriveMark(contrast: .onLight)
                .frame(width: 25, height: 25)
        )
        renderer.scale = 3
        return (renderer.uiImage ?? UIImage())
            .withRenderingMode(.alwaysTemplate)
    }()
}

/// The OFFICIAL Drive mark — sporty flat-bottom D-rim steering wheel with
/// the Cline head as its hub (assets/drive/, DEC-drive-mark-official).
struct DriveMark: View {
    @Environment(\.colorScheme) private var colorScheme

    var contrast: DriveBrand.Contrast = .adaptive

    var body: some View {
        Image("DriveMark")
            .resizable()
            .renderingMode(.template)
            .foregroundStyle(DriveBrand.foreground(for: contrast, colorScheme: colorScheme))
            .aspectRatio(1, contentMode: .fit)
            .accessibilityHidden(true)
    }
}

/// A small steering motion avoids tumbling the complete mark. Stills under
/// Reduce Motion.
struct DriveSpinner: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false

    var size: CGFloat = 28
    var contrast: DriveBrand.Contrast = .adaptive

    @State private var spin = false

    var body: some View {
        DriveMark(contrast: contrast)
            .rotationEffect(.degrees(spin ? 7 : -7))
            .frame(width: size, height: size)
            .onAppear {
                guard !(systemReduceMotion || appReduceMotion) else { return }
                withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                    spin = true
                }
            }
    }
}
