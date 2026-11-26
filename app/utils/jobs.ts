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

/** Where the work happens: a country (required) and up to this many cities in it (optional). */
export const MAX_JOB_LOCATIONS = 10
export const MAX_JOB_CITY_LENGTH = 80
/** Polish cities suggested in the cities field (see CITY_SUGGESTIONS); others can be typed in. */
export const SUGGESTED_CITIES = [
  'Warszawa', 'Kraków', 'Wrocław', 'Łódź', 'Poznań', 'Gdańsk', 'Gdynia', 'Szczecin', 'Bydgoszcz', 'Lublin',
  'Białystok', 'Katowice', 'Rzeszów', 'Toruń', 'Kielce', 'Olsztyn', 'Opole', 'Częstochowa', 'Radom', 'Zielona Góra'
] as const

/**
 * Cleans a list of city names: whitespace collapsed, length capped, empty ones dropped,
 * duplicates (ignoring case) removed, at most `max`. Unlike tags, the case is kept, and a
 * name matching a suggested city takes its spelling ("kraków" → "Kraków").
 */
export function normalizeLocations(values: unknown, max = MAX_JOB_LOCATIONS): string[] {
  if (!Array.isArray(values)) return []
  const result: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const typed = value.replace(/\s+/g, ' ').trim().slice(0, MAX_JOB_CITY_LENGTH).trim()
    const city = SUGGESTED_CITIES.find(c => c.toLocaleLowerCase() === typed.toLocaleLowerCase()) ?? typed
    if (city && !result.some(c => c.toLocaleLowerCase() === city.toLocaleLowerCase())) result.push(city)
    if (result.length === max) break
  }
  return result
}

export interface NewJob {
  title: string
  /** Free-text tags typed by the client (see utils/tags.ts). The form requires at least one; jobs from before tags existed have none. */
  tags: string[]
  description: string
  /** ISO 3166-1 alpha-2 code of the country where the work happens (see utils/countries.ts). */
  country: string
  /** Cities in that country (see normalizeLocations); may be empty ("anywhere in the country"). */
  locations: string[]
  /** Whole amount in `currency`, or null when the client didn't give a budget. */
  budget: { amount: number, currency: JobCurrency } | null
}

export interface Job extends Omit<NewJob, 'country'> {
  id: string
  /** uid of the user who posted the job. */
  owner: string
  status: 'open'
  /** Null for jobs posted before countries existed. */
  country: string | null
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

// --- Filtering by location ---

/**
 * Most cities a "Find work" location filter can combine. Together with MAX_FILTER_TAGS this
 * keeps tag × city pairs within Firestore's limit of 30 values for "contains any".
 */
export const MAX_FILTER_LOCATIONS = 3

function cityKey(city: string) {
  return city.toLocaleLowerCase()
}

function tagLocationKeys(tags: string[], cityKeys: string[]) {
  return tags.flatMap(tag => cityKeys.map(city => `${tag}|${city}`))
}

/**
 * Hidden lookup values stored on each job (`search.*`) for filtering by location. Cities are
 * lowercased so matching ignores case. Firestore allows only one "contains any" condition per
 * query, so filtering by tags and cities together uses `search.tagLocations`: every
 * "tag|city" pair of the job.
 */
function searchFields(job: Pick<NewJob, 'tags' | 'locations'>) {
  const cities = job.locations.map(cityKey)
  return {
    locations: cities,
    tagLocations: tagLocationKeys(job.tags, cities)
  }
}

// --- Writing ---

/** Saves a new job owned by `user`. Returns the new document's id. */
export async function postJob(user: User, job: NewJob) {
  const ref = await addDoc(jobsCollection(), {
    ...job,
    owner: user.uid,
    sort: sortFields(job),
    search: searchFields(job),
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
    search: searchFields(job),
    // Fields replaced by newer ones: category (now tags) and location (now locations).
    category: deleteField(),
    location: deleteField(),
    updatedAt: serverTimestamp()
  })
}

/** Deletes a job together with its applications (Firestore doesn't delete subcollections). */
export async function deleteJob(id: string) {
  await deleteApplications(id)
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

/**
 * Adds the `search.*` lookup values to the user's jobs saved before they existed (location
 * filters would miss those jobs). Reads all of the user's jobs; returns how many were updated.
 */
export async function addMissingSearchFields(user: User) {
  const mine = await getDocs(query(jobsCollection(), where('owner', '==', user.uid)))
  const missing = mine.docs.filter(d => d.data().search === undefined)
  for (let i = 0; i < missing.length; i += 500) {
    const batch = writeBatch(useFirestore())
    for (const d of missing.slice(i, i + 500)) batch.update(d.ref, { search: searchFields(jobFromDoc(d)) })
    await batch.commit()
  }
  return missing.length
}

const legacyMoves = new Map<string, Promise<void>>()

/**
 * Brings the user's own jobs up to date, once per user per page load: moves jobs from the old
 * location (moveLegacyJobs), then adds missing search values (addMissingSearchFields).
 * Failures are logged and retried on the next call; they don't block loading jobs.
 */
export function ensureLegacyJobsMoved(user: User) {
  let move = legacyMoves.get(user.uid)
  if (!move) {
    move = moveLegacyJobs(user).then(() => addMissingSearchFields(user)).then(() => {}, (e) => {
      console.warn('Could not update older jobs', e)
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
    country: isCountryCode(data.country) ? data.country : null,
    // Older jobs had a single `location` ({ mode, city }); keep its city, if any.
    locations: Array.isArray(data.locations)
      ? normalizeLocations(data.locations)
      : normalizeLocations([data.location?.city]),
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
 * Jobs in `scope`, optionally only those with any of `tags` and/or in any of `locations`.
 * Each combination of scope, filter and sort needs a composite index from
 * firestore.indexes.json (location filters are only indexed for open jobs).
 */
function jobsQuery(scope: JobScope, tags: string[], locations: string[]) {
  const scoped = scope.kind === 'mine' ? where('owner', '==', scope.user.uid) : where('status', '==', 'open')
  const cities = locations.map(cityKey)
  const filter = tags.length && cities.length
    ? where('search.tagLocations', 'array-contains-any', tagLocationKeys(tags, cities))
    : tags.length
      ? where('tags', 'array-contains-any', tags)
      : cities.length
        ? where('search.locations', 'array-contains-any', cities)
        : null
  return filter ? query(jobsCollection(), scoped, filter) : query(jobsCollection(), scoped)
}

/**
 * One page of jobs in `scope`, in `sort` order, optionally only those with any of `tags`
 * and/or in any of `locations`. Pass the previous page's `cursor` as `after` for the next
 * page (with the same scope, filters and sort). Fetches one extra document to know whether
 * another page exists.
 */
export async function fetchJobs(
  scope: JobScope,
  pageSize: number,
  after: JobCursor | null = null,
  tags: string[] = [],
  sort: JobSort = 'newest',
  locations: string[] = []
) {
  const snapshot = await getDocs(query(
    jobsQuery(scope, tags, locations),
    ...SORT_ORDER[sort].map(([field, direction]) => orderBy(field, direction)),
    ...(after ? [startAfter(after)] : []),
    limit(pageSize + 1)
  ))
  const docs = snapshot.docs.slice(0, pageSize)
  return { jobs: docs.map(jobFromDoc), cursor: docs.at(-1) ?? null, hasMore: snapshot.size > pageSize }
}

/** Number of jobs in `scope` matching the same filters (one cheap aggregation query). */
export async function countJobs(scope: JobScope, tags: string[] = [], locations: string[] = []) {
  const snapshot = await getCountFromServer(jobsQuery(scope, tags, locations))
  return snapshot.data().count
}

/**
 * Any job the user may see (open jobs, and their own in any status), or null if it doesn't
 * exist or they may not see it.
 */
export async function fetchJob(id: string) {
  try {
    const snapshot = await getDoc(doc(jobsCollection(), id))
    return snapshot.exists() ? jobFromDoc(snapshot) : null
  } catch (e) {
    if ((e as FirebaseError).code === 'permission-denied') return null
    throw e
  }
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
