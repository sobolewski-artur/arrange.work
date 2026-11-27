// Notification shapes, used by the app and the API. Auto-imported in both.

/** How many notifications the list shows (newest first, across all kinds). */
export const MAX_NOTIFICATIONS = 20

/**
 * - `applied`: someone applied to one of the user's jobs (the user is the job owner).
 * - `accepted` / `rejected`: the owner decided on one of the user's applications.
 */
export type NotificationKind = 'applied' | 'accepted' | 'rejected'

/** A notification, built straight from the application it's about. */
export interface AppNotification {
  /** `${kind}:${jobId}/${applicantUid}`, unique per notification. */
  id: string
  kind: NotificationKind
  jobId: string
  jobTitle: string
  /** The applicant's name (for `applied`). */
  name: string
  /** When it happened: the application time, or the decision time. */
  at: Date | null
}
