import type { User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Timestamp
} from 'firebase/firestore'

export const MAX_APPLICATION_MESSAGE_LENGTH = 2000
/** The job owner sees at most this many applications (oldest first). */
export const MAX_LISTED_APPLICATIONS = 100

/**
 * A specialist's application to a job, stored at jobs/{jobId}/applications/{applicantUid}
 * (so each user can apply once per job). The applicant's name and email are shared with the
 * job's owner; firestore.rules lets only the applicant and the owner read it.
 */
export interface Application {
  applicant: string
  name: string
  email: string
  message: string
  status: 'pending'
  createdAt: Date | null
}

function applicationsCollection(jobId: string) {
  return collection(useFirestore(), 'jobs', jobId, 'applications')
}

function applicationFromData(data: DocumentData): Application {
  return {
    applicant: data.applicant,
    name: data.name,
    email: data.email,
    message: data.message,
    status: data.status,
    createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null
  }
}

/** Applies to a job as `user`, sharing their display name (or email) and email with the owner. */
export async function applyToJob(user: User, jobId: string, message: string) {
  await setDoc(doc(applicationsCollection(jobId), user.uid), {
    applicant: user.uid,
    name: user.displayName || user.email || '',
    email: user.email ?? '',
    message,
    status: 'pending',
    createdAt: serverTimestamp()
  })
}

/** The user's own application to a job, or null if they haven't applied. */
export async function fetchMyApplication(user: User, jobId: string) {
  const snapshot = await getDoc(doc(applicationsCollection(jobId), user.uid))
  return snapshot.exists() ? applicationFromData(snapshot.data({ serverTimestamps: 'estimate' })) : null
}

export async function withdrawApplication(user: User, jobId: string) {
  await deleteDoc(doc(applicationsCollection(jobId), user.uid))
}

/** Applications to a job, oldest first (only the job's owner may list them). */
export async function fetchApplications(jobId: string) {
  const snapshot = await getDocs(query(applicationsCollection(jobId), orderBy('createdAt', 'asc'), limit(MAX_LISTED_APPLICATIONS)))
  return snapshot.docs.map(d => applicationFromData(d.data({ serverTimestamps: 'estimate' })))
}

/** Deletes all applications to a job (used before deleting the job itself). */
export async function deleteApplications(jobId: string) {
  const snapshot = await getDocs(applicationsCollection(jobId))
  await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)))
}
