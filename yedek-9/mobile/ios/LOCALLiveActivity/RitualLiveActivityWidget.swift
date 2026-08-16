import ActivityKit
import SwiftUI
import WidgetKit

private let brandOrange = Color(red: 0.976, green: 0.631, blue: 0.239)

private func phaseLabel(_ phase: String) -> String {
  switch phase {
  case "prelobby": return "Baslamaya"
  case "live": return "Canli"
  case "window": return "Window"
  default: return phase
  }
}

private struct BrandMarkView: View {
  let mark: String

  var body: some View {
    Text(mark.isEmpty ? "L" : mark)
      .font(.system(size: 14, weight: .heavy))
      .foregroundStyle(.white)
      .frame(width: 28, height: 28)
      .background(brandOrange, in: RoundedRectangle(cornerRadius: 8))
  }
}

private struct CountdownView: View {
  let endsAt: Date

  var body: some View {
    Text(timerInterval: Date.now...endsAt, countsDown: true)
      .monospacedDigit()
      .font(.system(size: 16, weight: .bold))
      .foregroundStyle(.white)
  }
}

private struct LockScreenView: View {
  let context: ActivityViewContext<RitualActivityAttributes>

  var body: some View {
    HStack(spacing: 12) {
      BrandMarkView(mark: context.state.brandMark)
      VStack(alignment: .leading, spacing: 2) {
        Text(context.attributes.title)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
        Text(phaseLabel(context.state.phase))
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer()
      CountdownView(endsAt: context.state.endsAt)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

struct RitualLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RitualActivityAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(Color.black.opacity(0.88))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          BrandMarkView(mark: context.state.brandMark)
        }
        DynamicIslandExpandedRegion(.trailing) {
          CountdownView(endsAt: context.state.endsAt)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.title)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(phaseLabel(context.state.phase))
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      } compactLeading: {
        BrandMarkView(mark: context.state.brandMark)
      } compactTrailing: {
        CountdownView(endsAt: context.state.endsAt)
      } minimal: {
        BrandMarkView(mark: context.state.brandMark)
      }
    }
  }
}

@main
struct LOCALLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    RitualLiveActivityWidget()
  }
}
