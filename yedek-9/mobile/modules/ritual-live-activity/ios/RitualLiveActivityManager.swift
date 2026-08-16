import ActivityKit
import Foundation

enum RitualLiveActivityError: Error {
  case invalidDate
  case unsupportedOS
}

@available(iOS 16.2, *)
public final class RitualLiveActivityManager {
  public static let shared = RitualLiveActivityManager()

  private var trackedActivity: Activity<RitualActivityAttributes>?

  private init() {}

  private func parseEndsAt(_ iso: String, remainingSeconds: Int) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
      return date
    }
    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: iso) {
      return date
    }
    if remainingSeconds > 0 {
      return Date().addingTimeInterval(TimeInterval(remainingSeconds))
    }
    return nil
  }

  @MainActor
  public func start(
    ritualId: String,
    title: String,
    phase: String,
    brandMark: String,
    endsAtISO: String,
    remainingSeconds: Int
  ) async throws -> String {
    await endAll()

    guard let endsAt = parseEndsAt(endsAtISO, remainingSeconds: remainingSeconds) else {
      throw RitualLiveActivityError.invalidDate
    }

    let attributes = RitualActivityAttributes(ritualId: ritualId, title: title)
    let state = RitualActivityAttributes.ContentState(
      phase: phase,
      brandMark: brandMark,
      endsAt: endsAt
    )
    let content = ActivityContent(state: state, staleDate: endsAt)

    let activity = try Activity.request(
      attributes: attributes,
      content: content,
      pushType: nil
    )
    trackedActivity = activity
    return activity.id
  }

  @MainActor
  public func update(
    ritualId: String,
    title: String,
    phase: String,
    brandMark: String,
    endsAtISO: String,
    remainingSeconds: Int
  ) async throws {
    guard let endsAt = parseEndsAt(endsAtISO, remainingSeconds: remainingSeconds) else {
      throw RitualLiveActivityError.invalidDate
    }

    let state = RitualActivityAttributes.ContentState(
      phase: phase,
      brandMark: brandMark,
      endsAt: endsAt
    )
    let content = ActivityContent(state: state, staleDate: endsAt)

    if let activity = trackedActivity ?? Activity<RitualActivityAttributes>.activities.first {
      await activity.update(content)
      trackedActivity = activity
      return
    }

    _ = try await start(
      ritualId: ritualId,
      title: title,
      phase: phase,
      brandMark: brandMark,
      endsAtISO: endsAtISO,
      remainingSeconds: remainingSeconds
    )
  }

  @MainActor
  public func endAll() async {
    for activity in Activity<RitualActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    trackedActivity = nil
  }
}
