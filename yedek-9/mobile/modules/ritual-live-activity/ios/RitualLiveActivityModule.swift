import ActivityKit
import ExpoModulesCore

struct LiveActivityPayload: Record {
  @Field var ritualId: String
  @Field var title: String
  @Field var phase: String
  @Field var brandMark: String = "L"
  @Field var endsAt: String
  @Field var remainingSeconds: Int = 0
}

public class RitualLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RitualLiveActivity")

    Function("isSupported") { () -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (payload: LiveActivityPayload) -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        return ["ok": false, "reason": "unsupported_os"]
      }
      do {
        let activityId = try await RitualLiveActivityManager.shared.start(
          ritualId: payload.ritualId,
          title: payload.title,
          phase: payload.phase,
          brandMark: payload.brandMark,
          endsAtISO: payload.endsAt,
          remainingSeconds: payload.remainingSeconds
        )
        return ["ok": true, "platform": "ios_activitykit", "activityId": activityId]
      } catch {
        return ["ok": false, "reason": error.localizedDescription]
      }
    }

    AsyncFunction("update") { (payload: LiveActivityPayload) -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        return ["ok": false, "reason": "unsupported_os"]
      }
      do {
        try await RitualLiveActivityManager.shared.update(
          ritualId: payload.ritualId,
          title: payload.title,
          phase: payload.phase,
          brandMark: payload.brandMark,
          endsAtISO: payload.endsAt,
          remainingSeconds: payload.remainingSeconds
        )
        return ["ok": true, "platform": "ios_activitykit"]
      } catch {
        return ["ok": false, "reason": error.localizedDescription]
      }
    }

    AsyncFunction("end") { () -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        return ["ok": false, "reason": "unsupported_os"]
      }
      await RitualLiveActivityManager.shared.endAll()
      return ["ok": true, "platform": "ios_activitykit"]
    }
  }
}
