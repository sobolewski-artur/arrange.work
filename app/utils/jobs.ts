import type { FirebaseError } from 'firebase/app'
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
  where,
  writeBatch,
  type DocumentData,
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
  /** uid of the user who posted the job. */
  owner: string
  status: 'open'
  /** Null for jobs posted before the location field existed. */
  location: JobLocation | null
  createdAt: Date | null
}

/** Opaque position in a job list, passed back to fetch the page after it. */
export type JobCursor = QueryDocumentSnapshot

/**
 * All jobs live in the top-level `jobs` collection; each has an `owner` field with the uid of
 * the user who posted it. firestore.rules lets any verified user read open jobs, and only the
 * owner change or delete a job (or read it once it's no longer open).
 */
function jobsCollection() {
  return collection(useFirestore(), 'jobs')
}

// --- Sorting ---

export const JOB_SORTS = ['newest', 'oldest', 'budgetHigh', 'budgetLow'] as const
export type JobSort = typeof JOB_SORTS[number]

/**
 * Hidden values stored on each job (`sort.*`) so budget sorting can put jobs without a budget
 * last in both directions. Firestore leaves out documents missing the sorted field, and
 * can't order nulls last, so "no budget" is stored as the lowest value for high-to-low and
 * the highest for low-to-high. Amounts in different currencies are compared as plain numbers.
 */
function sortFields(job: Pick<NewJob, 'budget'>) {
  const amount = job.budget?.amount ?? null
  return {
    budgetHigh: amount ?? -1,
    budgetLow: amount ?? Number.MAX_SAFE_INTEGER
  }
}

/** Field and direction per sort. Budget sorts fall back to newest first for equal amounts. */
const SORT_ORDER: Record<JobSort, [field: string, direction: 'asc' | 'desc'][]> = {
  newest: [['createdAt', 'desc']],
  oldest: [['createdAt', 'asc']],
  budgetHigh: [['sort.budgetHigh', 'desc'], ['createdAt', 'desc']],
  budgetLow: [['sort.budgetLow', 'asc'], ['createdAt', 'desc']]
}

// --- Writing ---

/** Saves a new job owned by `user`. Returns the new document's id. */
export async function postJob(user: User, job: NewJob) {
  const ref = await addDoc(jobsCollection(), {
    ...job,
    owner: user.uid,
    sort: sortFields(job),
    status: 'open',
    createdAt: serverTimestamp()
  })
  return ref.id
}

/** Replaces the job's editable fields; keeps its owner, status and createdAt. */
export async function updateJob(id: string, job: NewJob) {
  await updateDoc(doc(jobsCollection(), id), {
    ...job,
    sort: sortFields(job),
    // Jobs posted before tags existed had a single category instead; drop it.
    category: deleteField(),
    updatedAt: serverTimestamp()
  })
}

export async function deleteJob(id: string) {
  await deleteDoc(doc(jobsCollection(), id))
}

/**
 * Moves jobs saved under the old location (users/{uid}/jobs) to the `jobs` collection, keeping
 * their ids (so old links still work) and adding `owner` and the sort values. Each job is
 * copied and its old copy deleted in one batch. Returns how many jobs were moved.
 */
export async function moveLegacyJobs(user: User) {
  const legacy = await getDocs(collection(useFirestore(), 'users', user.uid, 'jobs'))
  for (let i = 0; i < legacy.docs.length; i += 250) {
    const batch = writeBatch(useFirestore())
    for (const old of legacy.docs.slice(i, i + 250)) {
      const data = old.data()
      batch.set(doc(jobsCollection(), old.id), {
        ...data,
        owner: user.uid,
        sort: sortFields({ budget: data.budget ?? null })
      })
      batch.delete(old.ref)
    }
    await batch.commit()
  }
  return legacy.size
}

const legacyMoves = new Map<string, Promise<void>>()

/**
 * Runs moveLegacyJobs once per user per page load (an empty old location costs one read).
 * Failures are logged and retried on the next call; they don't block loading jobs.
 */
export function ensureLegacyJobsMoved(user: User) {
  let move = legacyMoves.get(user.uid)
  if (!move) {
    move = moveLegacyJobs(user).then(() => {}, (e) => {
      console.warn('Could not move jobs from the old location', e)
      legacyMoves.delete(user.uid)
    })
    legacyMoves.set(user.uid, move)
  }
  return move
}

// --- Reading ---

function jobFromDoc(snapshot: DocumentSnapshot): Job {
  // 'estimate' fills in a just-posted job's createdAt before the server confirms it.
  const data: DocumentData = snapshot.data({ serverTimestamps: 'estimate' })!
  return {
    id: snapshot.id,
    owner: data.owner,
    title: data.title,
    tags: normalizeTags(data.tags),
    description: data.description,
    location: data.location ?? null,
    budget: data.budget ?? null,
    status: data.status,
    createdAt: (data.createdAt as Timestamp | null)?.toDate() ?? null
  }
}

/**
 * Which jobs a list shows: the user's own jobs (any status), or every open job. The rules only
 * allow listing with one of these two filters, so every list query starts with one of them.
 */
export type JobScope = { kind: 'mine', user: User } | { kind: 'open' }

/**
 * Jobs in `scope`, optionally only those with any of `tags`. Each combination of scope, tag
 * filter and sort needs a composite index from firestore.indexes.json.
 */
function jobsQuery(scope: JobScope, tags: string[]) {
  const scoped = scope.kind === 'mine' ? where('owner', '==', scope.user.uid) : where('status', '==', 'open')
  return tags.length
    ? query(jobsCollection(), scoped, where('tags', 'array-contains-any', tags))
    : query(jobsCollection(), scoped)
}

/**
 * One page of jobs in `scope`, in `sort` order, optionally only those with any of `tags`.
 * Pass the previous page's `cursor` as `after` for the next page (with the same scope, tags
 * and sort). Fetches one extra document to know whether another page exists.
 */
export async function fetchJobs(
  scope: JobScope,
  pageSize: number,
  after: JobCursor | null = null,
  tags: string[] = [],
  sort: JobSort = 'newest'
) {
  const snapshot = await getDocs(query(
    jobsQuery(scope, tags),
    ...SORT_ORDER[sort].map(([field, direction]) => orderBy(field, direction)),
    ...(after ? [startAfter(after)] : []),
    limit(pageSize + 1)
  ))
  const docs = snapshot.docs.slice(0, pageSize)
  return { jobs: docs.map(jobFromDoc), cursor: docs.at(-1) ?? null, hasMore: snapshot.size > pageSize }
}

/** Number of jobs in `scope`, optionally only those with any of `tags` (one cheap aggregation query). */
export async function countJobs(scope: JobScope, tags: string[] = []) {
  const snapshot = await getCountFromServer(jobsQuery(scope, tags))
  return snapshot.data().count
}

/**
 * One of the user's jobs, or null if it doesn't exist or isn't theirs (the rules deny reading
 * someone else's job, which is reported the same as a wrong link).
 */
export async function fetchMyJob(user: User, id: string) {
  try {
    const snapshot = await getDoc(doc(jobsCollection(), id))
    if (!snapshot.exists()) return null
    const job = jobFromDoc(snapshot)
    return job.owner === user.uid ? job : null
  } catch (e) {
    if ((e as FirebaseError).code === 'permission-denied') return null
    throw e
  }
}
