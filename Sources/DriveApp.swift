import SwiftUI

@main
struct DriveApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var settingsDrafts = SettingsDraftStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(settingsDrafts)
                .preferredColorScheme(settingsDrafts.appearance == "Light" ? .light : settingsDrafts.appearance == "Dark" ? .dark : nil)
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
        .sheet(item: $store.settingsRoute) { route in
            SettingsModalView(route: route)
                .environmentObject(store)
        }
        .dynamicTypeSize(.xSmall ... .accessibility3)
        .onAppear {
            store.startWire()
            store.sweepExperiments()   // the one-week rule enforces itself
            NotificationManager.shared.configure(store: store)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                store.startWire()
                store.sweepExperiments()
            } else {
                store.pauseWire()
            }
        }
    }
}
