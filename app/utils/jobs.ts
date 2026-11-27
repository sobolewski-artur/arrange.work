// Job fields, rules and types are in shared/utils/jobs.ts (used by the API too).
// Jobs are stored in Postgres; server/api/jobs enforces who may read and change them: any
// verified user can read open jobs, and only the owner can change or delete a job (or read it
// once it's no longer open).

/** Opaque position in a job list, passed back to fetch the page after it. */
export type JobCursor = number

/** Which jobs a list shows: the user's own jobs (any status), or every open job. */
export type JobScope = { kind: 'mine', user: AppUser } | { kind: 'open' }

/** "Find work" location filter: a country, and optionally a city in it. */
export interface JobPlaceFilter {
  country: string | null
  city: string | null
}

export const NO_PLACE_FILTER: JobPlaceFilter = { country: null, city: null }

function listQuery(scope: JobScope, tags: string[], place: JobPlaceFilter) {
  return {
    scope: scope.kind,
    tags: tags.length ? tags.join(',') : undefined,
    country: place.country ?? undefined,
    city: place.country && place.city ? place.city : undefined
  }
}

// --- Writing ---

/** Saves a new job owned by the signed-in user. Returns its id. */
export async function postJob(job: NewJob) {
  const { id } = await api<{ id: string }>('/api/jobs', { method: 'POST', body: job })
  return id
}

/** Replaces the job's editable fields; keeps its owner, status and createdAt. */
export async function updateJob(id: string, job: NewJob) {
  await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PUT', body: job })
}

/** Deletes a job together with its applications. */
export async function deleteJob(id: string) {
  await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// --- Reading ---

/**
 * One page of jobs in `scope`, in `sort` order, optionally only those with any of `tags`
 * and/or in the country (and city) of `place`. Pass the previous page's `cursor` as `after` for the next
 * page (with the same scope, filters and sort).
 */
export async function fetchJobs(
  scope: JobScope,
  pageSize: number,
  after: JobCursor | null = null,
  tags: string[] = [],
  sort: JobSort = 'newest',
  place: JobPlaceFilter = NO_PLACE_FILTER
) {
  const offset = after ?? 0
  const page = await api<{ jobs: Job[], hasMore: boolean }>('/api/jobs', {
    query: { ...listQuery(scope, tags, place), sort, offset, limit: pageSize }
  })
  return {
    jobs: page.jobs.map(reviveJob),
    cursor: page.jobs.length ? offset + page.jobs.length : null,
    hasMore: page.hasMore
  }
}

/** Number of jobs in `scope` matching the same filters. */
export async function countJobs(scope: JobScope, tags: string[] = [], place: JobPlaceFilter = NO_PLACE_FILTER) {
  const { count } = await api<{ count: number }>('/api/jobs/count', { query: listQuery(scope, tags, place) })
  return count
}

/**
 * Any job the user may see (open jobs, and their own in any status), or null if it doesn't
 * exist or they may not see it.
 */
export async function fetchJob(id: string) {
  try {
    return reviveJob(await api<Job>(`/api/jobs/${encodeURIComponent(id)}`))
  } catch (e) {
    if (isNotFound(e)) return null
    throw e
  }
}

/** One of the user's jobs, or null if it doesn't exist or isn't theirs. */
export async function fetchMyJob(user: AppUser, id: string) {
  const job = await fetchJob(id)
  return job?.owner === user.uid ? job : null
}
