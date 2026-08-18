import SwiftUI

@main
struct DriveApp: App {
    @StateObject private var store = AppStore()
    @AppStorage("appearance") private var appearance = "System"

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(appearance == "Light" ? .light : appearance == "Dark" ? .dark : nil)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if store.launched {
                MainTabs()
            } else {
                OpenView()
            }
        }
        .fullScreenCover(isPresented: $store.inCall) {
            LiveCallView()
        }
        .dynamicTypeSize(.xSmall ... .accessibility3)
        .onAppear { store.startWire() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { store.startWire() } else { store.pauseWire() }
        }
    }
}
