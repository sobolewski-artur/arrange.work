import type { User } from 'firebase/auth'
import {
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type QueryDocumentSnapshot,
  type Query,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore'

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
  /** Empty for applications made before job titles were stored on them. */
  jobTitle: string
  /** The applicant's name (for `applied`). */
  name: string
  /** When it happened: the application time, or the decision time. */
  at: Date | null
}

function toDate(value: unknown) {
  return (value as Timestamp | null | undefined)?.toDate() ?? null
}

function fromApplication(d: QueryDocumentSnapshot, kind: NotificationKind, atField: 'createdAt' | 'decidedAt'): AppNotification {
  const data = d.data({ serverTimestamps: 'estimate' })
  const jobId = d.ref.parent.parent!.id
  return {
    id: `${kind}:${jobId}/${d.id}`,
    kind,
    jobId,
    jobTitle: data.jobTitle ?? '',
    name: data.name ?? '',
    at: toDate(data[atField])
  }
}

function watch(q: Query, map: (d: QueryDocumentSnapshot) => AppNotification, onChange: (list: AppNotification[]) => void, onError: (e: Error) => void) {
  return onSnapshot(q, snapshot => onChange(snapshot.docs.map(map)), onError)
}

/**
 * Live notifications for the user, from two collection-group queries over applications (the
 * rules allow both; each needs a COLLECTION_GROUP index):
 * - new applications to their jobs (jobOwner == uid; applications made before `jobOwner`
 *   was stored on them don't appear), and
 * - decisions on their own applications (applicant == uid, status accepted or rejected).
 * `onChange` gets both lists merged, newest first, capped at MAX_NOTIFICATIONS.
 */
export function watchNotifications(
  user: User,
  onChange: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const applications = collectionGroup(useFirestore(), 'applications')
  let applied: AppNotification[] = []
  let decided: AppNotification[] = []
  const emit = () => onChange(
    [...applied, ...decided]
      .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
      .slice(0, MAX_NOTIFICATIONS)
  )

  const stopApplied = watch(
    query(applications, where('jobOwner', '==', user.uid), orderBy('createdAt', 'desc'), limit(MAX_NOTIFICATIONS)),
    d => fromApplication(d, 'applied', 'createdAt'),
    (list) => { applied = list; emit() },
    onError
  )
  const stopDecided = watch(
    query(applications, where('applicant', '==', user.uid), where('status', 'in', ['accepted', 'rejected']), orderBy('decidedAt', 'desc'), limit(MAX_NOTIFICATIONS)),
    d => fromApplication(d, d.get('status') === 'accepted' ? 'accepted' : 'rejected', 'decidedAt'),
    (list) => { decided = list; emit() },
    onError
  )
  return () => {
    stopApplied()
    stopDecided()
  }
}

/**
 * Live "notifications last seen" time, stored on users/{uid} so it syncs across tabs and
 * devices. Null if the user has never opened their notifications.
 */
export function watchNotificationsSeenAt(user: User, onChange: (seenAt: Date | null) => void): Unsubscribe {
  return onSnapshot(doc(useFirestore(), 'users', user.uid), (snapshot) => {
    onChange(toDate(snapshot.data({ serverTimestamps: 'estimate' })?.notificationsSeenAt))
  }, (e) => console.warn('Could not read notification state', e))
}

/** Marks everything up to now as seen. */
export async function markNotificationsSeen(user: User) {
  await setDoc(doc(useFirestore(), 'users', user.uid), { notificationsSeenAt: serverTimestamp() }, { merge: true })
}
