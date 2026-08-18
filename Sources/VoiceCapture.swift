import AVFoundation
import Combine
import Foundation

/// Hold-to-talk capture, privacy-strict by construction: the engine tap
/// computes a loudness level and **drops the buffer immediately**. No
/// audio is retained, written, uploaded, or transcribed — the only thing
/// that survives a tap callback is a Float the waveform draws.
@MainActor
final class VoiceCapture: ObservableObject {
    static let shared = VoiceCapture()

    /// 0…1 smoothed loudness, published for the waveform.
    @Published private(set) var level: Float = 0
    /// True while the engine is actually running (mic granted + started).
    @Published private(set) var capturing = false
    /// Set when permission is refused, so the UI can be honest about it.
    @Published private(set) var denied = false

    private let engine = AVAudioEngine()
    private var installed = false

    func start() {
        guard !capturing else { return }
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            Task { @MainActor in
                guard let self else { return }
                guard granted else {
                    self.denied = true
                    return
                }
                self.denied = false
                self.beginEngine()
            }
        }
    }

    func stop() {
        guard capturing else { return }
        engine.pause()
        capturing = false
        // The level decays to zero; nothing else is kept.
        level = 0
    }

    private func beginEngine() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true)

            if !installed {
                let input = engine.inputNode
                let format = input.outputFormat(forBus: 0)
                input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                    // Compute RMS, publish, and let the buffer die here.
                    guard let channel = buffer.floatChannelData?[0] else { return }
                    let frames = Int(buffer.frameLength)
                    guard frames > 0 else { return }
                    var sum: Float = 0
                    for i in 0..<frames { sum += channel[i] * channel[i] }
                    let rms = (sum / Float(frames)).squareRoot()
                    // −50 dB floor → 0…1, smoothed so the bars breathe.
                    let db = 20 * log10(max(rms, 1e-7))
                    let normalized = max(0, min(1, (db + 50) / 50))
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        self.level += (normalized - self.level) * 0.35
                    }
                }
                installed = true
            }

            engine.prepare()
            try engine.start()
            capturing = true
        } catch {
            capturing = false
        }
    }
}
