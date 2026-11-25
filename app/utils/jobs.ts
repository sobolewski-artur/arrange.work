import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Timestamp
} from 'firebase/firestore'

export const MAX_JOB_TITLE_LENGTH = 100
export const MAX_JOB_DESCRIPTION_LENGTH = 5000
export const JOB_CURRENCIES = ['PLN', 'EUR', 'USD'] as const

export type JobCurrency = typeof JOB_CURRENCIES[number]

/** Where the work happens. On-site and hybrid jobs also have a city. */
export const JOB_LOCATION_MODES = ['remote', 'onsite', 'hybrid'] as const
export const MAX_JOB_CITY_LENGTH = 80
/** Suggestions offered in the city field; any other city can be typed in. */
export const SUGGESTED_CITIES = [
  'Warszawa', 'Kraków', 'Wrocław', 'Łódź', 'Poznań', 'Gdańsk', 'Gdynia', 'Szczecin', 'Bydgoszcz', 'Lublin',
  'Białystok', 'Katowice', 'Rzeszów', 'Toruń', 'Kielce', 'Olsztyn', 'Opole', 'Częstochowa', 'Radom', 'Zielona Góra'
] as const

export type JobLocationMode = typeof JOB_LOCATION_MODES[number]
export interface JobLocation {
  mode: JobLocationMode
  /** Set for on-site and hybrid jobs, null for remote ones. */
  city: string | null
}

export interface NewJob {
  title: string
  /** Free-text tags typed by the client (see utils/tags.ts). The form requires at least one; jobs from before tags existed have none. */
  tags: string[]
  description: string
  location: JobLocation
  /** Whole amount in `currency`, or null when the client didn't give a budget. */
  budget: { amount: number, currency: JobCurrency } | null
}

export interface Job extends Omit<NewJob, 'location'> {
  id: string
  status: 'open'
  /** Null for jobs posted before the location field existed. */
  location: JobLocation | null
  createdAt: Date | null
}

/** Opaque position in a job list, passed back to fetch the page after it. */
export type JobCursor = QueryDocumentSnapshot

function jobsCollection(user: User) {
  return collection(useFirestore(), 'users', user.uid, 'jobs')
}

/**
 * Saves a job the user posted to users/{uid}/jobs (readable and writable only by them,
 * see firestore.rules). Returns the new document's id.
 */
export async function postJob(user: User, job: NewJob) {
  const ref = await addDoc(jobsCollection(user), {
    ...job,
    status: 'open',
    createdAt: serverTimestamp()
  })
  return ref.id
}

/**
 * One page of the user's jobs, newest first. Pass the previous page's `cursor` as `after`
 * for the next page. Fetches one extra document to know whether another page exists.
 */
export async function fetchMyJobs(user: User, pageSize: number, after: JobCursor | null = null) {
  const snapshot = await getDocs(query(
    jobsCollection(user),
    orderBy('createdAt', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(pageSize + 1)
  ))
  const docs = snapshot.docs.slice(0, pageSize)
  return { jobs: docs.map(jobFromDoc), cursor: docs.at(-1) ?? null, hasMore: snapshot.size > pageSize }
}

function jobFromDoc(snapshot: DocumentSnapshot): Job {
  // 'estimate' fills in a just-posted job's createdAt before the server confirms it.
  const data = snapshot.data({ serverTimestamps: 'estimate' })!
  return {
    id: snapshot.id,
    title: data.title,
    tags: normalizeTags(data.tags),
    description: data.description,
    location: data.location ?? null,
    budget: data.budget ?? null,
    status: data.status,
    createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null
  }
}

/** One of the user's jobs, or null if it doesn't exist (e.g. deleted, or a wrong link). */
export async function fetchMyJob(user: User, id: string) {
  const snapshot = await getDoc(doc(jobsCollection(user), id))
  return snapshot.exists() ? jobFromDoc(snapshot) : null
}

/** Replaces the job's editable fields; keeps its status and createdAt. */
export async function updateJob(user: User, id: string, job: NewJob) {
  await updateDoc(doc(jobsCollection(user), id), {
    ...job,
    // Jobs posted before tags existed had a single category instead; drop it.
    category: deleteField(),
    updatedAt: serverTimestamp()
  })
}

export async function deleteJob(user: User, id: string) {
  await deleteDoc(doc(jobsCollection(user), id))
}

/** Total number of jobs the user has posted (one cheap aggregation query). */
export async function countMyJobs(user: User) {
  const snapshot = await getCountFromServer(jobsCollection(user))
  return snapshot.data().count
}
