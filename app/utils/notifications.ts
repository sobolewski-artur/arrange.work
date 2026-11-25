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
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore'

/** How many recent applications the notification list shows. */
export const MAX_NOTIFICATIONS = 20

/** "Someone applied to your job", built from the application itself. */
export interface ApplicationNotification {
  /** `${jobId}/${applicantUid}`, unique per application. */
  id: string
  jobId: string
  jobTitle: string
  name: string
  createdAt: Date | null
}

/**
 * Live list of the newest applications to the user's jobs. Applications store the job's owner
 * (`jobOwner`) and title (`jobTitle`) when created, so this is one collection-group query
 * (rules allow it only for jobOwner == your uid; needs a COLLECTION_GROUP index). Applications
 * made before those fields existed don't appear here.
 */
export function watchApplicationNotifications(
  user: User,
  onChange: (notifications: ApplicationNotification[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collectionGroup(useFirestore(), 'applications'),
    where('jobOwner', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(MAX_NOTIFICATIONS)
  )
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' })
      const jobId = d.ref.parent.parent!.id
      return {
        id: `${jobId}/${d.id}`,
        jobId,
        jobTitle: data.jobTitle ?? '',
        name: data.name ?? '',
        createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null
      }
    }))
  }, onError)
}

/**
 * Live "notifications last seen" time, stored on users/{uid} so it syncs across tabs and
 * devices. Null if the user has never opened their notifications.
 */
export function watchNotificationsSeenAt(user: User, onChange: (seenAt: Date | null) => void): Unsubscribe {
  return onSnapshot(doc(useFirestore(), 'users', user.uid), (snapshot) => {
    const seenAt = snapshot.data({ serverTimestamps: 'estimate' })?.notificationsSeenAt as Timestamp | undefined
    onChange(seenAt?.toDate() ?? null)
  }, (e) => console.warn('Could not read notification state', e))
}

/** Marks everything up to now as seen. */
export async function markNotificationsSeen(user: User) {
  await setDoc(doc(useFirestore(), 'users', user.uid), { notificationsSeenAt: serverTimestamp() }, { merge: true })
}
