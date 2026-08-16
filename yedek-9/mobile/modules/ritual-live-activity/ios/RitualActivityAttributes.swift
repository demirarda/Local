import ActivityKit
import Foundation

public struct RitualActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var phase: String
    public var brandMark: String
    public var endsAt: Date

    public init(phase: String, brandMark: String, endsAt: Date) {
      self.phase = phase
      self.brandMark = brandMark
      self.endsAt = endsAt
    }
  }

  public var ritualId: String
  public var title: String

  public init(ritualId: String, title: String) {
    self.ritualId = ritualId
    self.title = title
  }
}
