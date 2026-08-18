import SwiftUI

/// The official Cline bot mark — converted 1:1 from
/// cline-logo-filled.svg (the asset the hub's ClineMarkIcon traces).
/// Sharp side ears, round antenna dome, pill eyes. viewBox 466.73×487.04,
/// even-odd fill. Generated — regenerate only from that SVG.
struct ClineBotShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 466.73, rect.height / 487.04)
        let ox = rect.midX - 466.73 / 2 * scale
        let oy = rect.midY - 487.04 / 2 * scale
        func pt(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: ox + x * scale, y: oy + y * scale)
        }
        var p = Path()
        p.move(to: pt(463.600, 275.080))
        p.addLine(to: pt(434.340, 216.330))
        p.addLine(to: pt(434.340, 182.500))
        p.addCurve(to: pt(333.810, 81.000), control1: pt(434.340, 126.420), control2: pt(389.330, 81.000))
        p.addLine(to: pt(283.800, 81.000))
        p.addCurve(to: pt(289.410, 56.390), control1: pt(287.420, 73.570), control2: pt(289.410, 65.210))
        p.addCurve(to: pt(233.340, 0.000), control1: pt(289.410, 25.220), control2: pt(264.330, 0.000))
        p.addCurve(to: pt(177.270, 56.390), control1: pt(202.350, 0.000), control2: pt(177.270, 25.220))
        p.addCurve(to: pt(182.880, 81.000), control1: pt(177.270, 65.210), control2: pt(179.260, 73.560))
        p.addLine(to: pt(132.870, 81.000))
        p.addCurve(to: pt(32.350, 182.500), control1: pt(77.360, 81.000), control2: pt(32.350, 126.420))
        p.addLine(to: pt(32.350, 216.330))
        p.addLine(to: pt(2.480, 274.920))
        p.addCurve(to: pt(2.480, 293.730), control1: pt(-0.530, 280.820), control2: pt(-0.530, 287.840))
        p.addLine(to: pt(32.350, 351.660))
        p.addLine(to: pt(32.350, 385.490))
        p.addCurve(to: pt(132.870, 486.990), control1: pt(32.350, 441.570), control2: pt(77.360, 486.990))
        p.addLine(to: pt(333.820, 486.990))
        p.addCurve(to: pt(434.350, 385.490), control1: pt(389.330, 486.990), control2: pt(434.350, 441.570))
        p.addLine(to: pt(434.350, 351.660))
        p.addLine(to: pt(463.560, 293.530))
        p.addCurve(to: pt(463.610, 275.070), control1: pt(466.460, 287.740), control2: pt(466.460, 280.920))
        p.closeSubpath()
        p.move(to: pt(202.750, 322.960))
        p.addCurve(to: pt(156.870, 369.100), control1: pt(202.750, 348.440), control2: pt(182.210, 369.100))
        p.addCurve(to: pt(110.990, 322.960), control1: pt(131.530, 369.100), control2: pt(110.990, 348.440))
        p.addLine(to: pt(110.990, 240.940))
        p.addCurve(to: pt(156.870, 194.800), control1: pt(110.990, 215.460), control2: pt(131.530, 194.800))
        p.addCurve(to: pt(202.750, 240.940), control1: pt(182.210, 194.800), control2: pt(202.750, 215.460))
        p.addLine(to: pt(202.750, 322.960))
        p.closeSubpath()
        p.move(to: pt(350.580, 322.960))
        p.addCurve(to: pt(304.700, 369.100), control1: pt(350.580, 348.440), control2: pt(330.040, 369.100))
        p.addCurve(to: pt(258.820, 322.960), control1: pt(279.360, 369.100), control2: pt(258.820, 348.440))
        p.addLine(to: pt(258.820, 240.940))
        p.addCurve(to: pt(304.700, 194.800), control1: pt(258.820, 215.460), control2: pt(279.360, 194.800))
        p.addCurve(to: pt(350.580, 240.940), control1: pt(330.040, 194.800), control2: pt(350.580, 215.460))
        p.addLine(to: pt(350.580, 322.960))
        p.closeSubpath()
        return p
    }
}
