import WidgetKit
import SwiftUI

// Data structure shared across the App Group via UserDefaults
struct HydrationSnapshot: Codable {
    let todayMl: Int
    let goalMl: Int
    let pct: Double
    let unit: String
    let formattedToday: String
    let formattedGoal: String
    let quickAddMl: Int
    let quickAddLabel: String
    let updatedAt: Double
}

struct Provider: TimelineProvider {
    let appGroup = "group.com.praveeng.hydrate"
    let storageKey = "hydrate_widget_snapshot"

    func placeholder(in context: Context) -> HydrationEntry {
        HydrationEntry(date: Date(), todayText: "1,250 ml", goalText: "2,500 ml", pct: 0.5, quickAddLabel: "+250 ml", quickAddMl: 250)
    }

    func getSnapshot(in context: Context, completion: @escaping (HydrationEntry) -> ()) {
        completion(loadCurrentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = loadCurrentEntry()
        // Refresh every 30 minutes or when app updates the shared snapshot
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadCurrentEntry() -> HydrationEntry {
        guard let sharedDefaults = UserDefaults(suiteName: appGroup),
              let jsonString = sharedDefaults.string(forKey: storageKey),
              let data = jsonString.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(HydrationSnapshot.self, from: data) else {
            return HydrationEntry(date: Date(), todayText: "0 ml", goalText: "2,500 ml", pct: 0.0, quickAddLabel: "+250 ml", quickAddMl: 250)
        }

        return HydrationEntry(
            date: Date(),
            todayText: snapshot.formattedToday,
            goalText: snapshot.formattedGoal,
            pct: snapshot.pct,
            quickAddLabel: snapshot.quickAddLabel,
            quickAddMl: snapshot.quickAddMl
        )
    }
}

struct HydrationEntry: TimelineEntry {
    let date: Date
    let todayText: String
    let goalText: String
    let pct: Double
    let quickAddLabel: String
    let quickAddMl: Int
}

struct HydrationWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.18, blue: 0.29) // Tide dark surface
            
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("💧 Hydrate")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 0.92, green: 0.95, blue: 0.98))
                    Spacer()
                    Text("\(Int(min(1.5, entry.pct) * 100))%")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.05, green: 0.55, blue: 0.91))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }

                Spacer()

                Text(entry.todayText)
                    .font(.system(size: 24, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)

                Text("of \(entry.goalText)")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(red: 0.59, green: 0.67, blue: 0.74))

                // Progress Bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.12))
                            .frame(height: 6)
                        Capsule()
                            .fill(LinearGradient(colors: [Color(red: 0.30, green: 0.79, blue: 1.0), Color(red: 0.15, green: 0.39, blue: 0.92)], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, min(geo.size.width, geo.size.width * CGFloat(entry.pct))), height: 6)
                    }
                }
                .frame(height: 6)

                Spacer()

                HStack {
                    Spacer()
                    Link(destination: URL(string: "hydrate://quick-add?ml=\(entry.quickAddMl)")!) {
                        Text("\(entry.quickAddLabel) ✅")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color(red: 0.05, green: 0.55, blue: 0.91))
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
            }
            .padding(14)
        }
    }
}

@main
struct HydrationWidget: Widget {
    let kind: String = "HydrationWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            HydrationWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Hydrate Tracker")
        .description("Track your daily water goal and log sips with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
