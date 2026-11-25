import type { User } from 'firebase/auth'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
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
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export interface Application {
  applicant: string
  name: string
  email: string
  message: string
  /** Set by the job's owner; new applications are 'pending'. */
  status: ApplicationStatus
  createdAt: Date | null
  /** When the owner accepted or rejected it; null while pending. */
  decidedAt: Date | null
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
    status: (APPLICATION_STATUSES as readonly string[]).includes(data.status) ? data.status : 'pending',
    createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null,
    decidedAt: (data.decidedAt as Timestamp | null)?.toDate() ?? null
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

/**
 * Accepts or rejects an application (or puts it back to pending). Only the job's owner may;
 * the rules allow changing nothing but `status` and `decidedAt`.
 */
export async function setApplicationStatus(jobId: string, applicantId: string, status: ApplicationStatus) {
  await updateDoc(doc(applicationsCollection(jobId), applicantId), {
    status,
    decidedAt: status === 'pending' ? null : serverTimestamp()
  })
}

// --- "My applications": the user's applications across all jobs ---

/** An application together with the job it's for (null if the job is gone or not visible). */
export interface MyApplication {
  jobId: string
  application: Application
  job: Job | null
}

/** Opaque position in the list, passed back to fetch the page after it. */
export type ApplicationCursor = QueryDocumentSnapshot

/**
 * Collection-group query over every job's applications, filtered to the user (required by the
 * rules) and optionally a status, newest first. Needs the COLLECTION_GROUP indexes in
 * firestore.indexes.json.
 */
function myApplicationsQuery(user: User, status: ApplicationStatus | null) {
  return query(
    collectionGroup(useFirestore(), 'applications'),
    where('applicant', '==', user.uid),
    ...(status ? [where('status', '==', status)] : []),
    orderBy('createdAt', 'desc')
  )
}

/**
 * One page of the user's applications (optionally only one status), each with its job loaded.
 * Fetches one extra document to know whether another page exists.
 */
export async function fetchMyApplications(
  user: User,
  pageSize: number,
  after: ApplicationCursor | null = null,
  status: ApplicationStatus | null = null
) {
  const snapshot = await getDocs(query(
    myApplicationsQuery(user, status),
    ...(after ? [startAfter(after)] : []),
    limit(pageSize + 1)
  ))
  const docs = snapshot.docs.slice(0, pageSize)
  const items: MyApplication[] = await Promise.all(docs.map(async (d) => {
    // Path is jobs/{jobId}/applications/{uid}.
    const jobId = d.ref.parent.parent!.id
    const job = await fetchJob(jobId).catch(() => null)
    return { jobId, application: applicationFromData(d.data({ serverTimestamps: 'estimate' })), job }
  }))
  return { items, cursor: docs.at(-1) ?? null, hasMore: snapshot.size > pageSize }
}

/** Number of the user's applications, optionally only one status. */
export async function countMyApplications(user: User, status: ApplicationStatus | null = null) {
  const snapshot = await getCountFromServer(myApplicationsQuery(user, status))
  return snapshot.data().count
}

/** Deletes all applications to a job (used before deleting the job itself). */
export async function deleteApplications(jobId: string) {
  const snapshot = await getDocs(applicationsCollection(jobId))
  await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)))
}
