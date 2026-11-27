// Application fields, rules and types are in shared/utils/applications.ts. Applications are
// stored in Postgres; server/api enforces that only the applicant and the job's owner can
// read one, and only the owner can accept or reject it.

function applicationsPath(jobId: string) {
  return `/api/jobs/${encodeURIComponent(jobId)}/applications`
}

/** Applies to a job as `user`, sharing their display name (or email) and email with the owner. */
export async function applyToJob(user: AppUser, job: Pick<Job, 'id'>, message: string) {
  await api(`${applicationsPath(job.id)}/me`, {
    method: 'PUT',
    body: { name: user.displayName || user.email || '', message }
  })
}

/** The signed-in user's own application to a job, or null if they haven't applied. */
export async function fetchMyApplication(jobId: string) {
  const { application } = await api<{ application: Application | null }>(`${applicationsPath(jobId)}/me`)
  return application ? reviveApplication(application) : null
}

export async function withdrawApplication(jobId: string) {
  await api(`${applicationsPath(jobId)}/me`, { method: 'DELETE' })
}

/** Applications to a job, oldest first (only the job's owner may list them). */
export async function fetchApplications(jobId: string) {
  const list = await api<Application[]>(applicationsPath(jobId))
  return list.map(reviveApplication)
}

/** Accepts or rejects an application (or puts it back to pending). Only the job's owner may. */
export async function setApplicationStatus(jobId: string, applicantId: string, status: ApplicationStatus) {
  await api(`${applicationsPath(jobId)}/${encodeURIComponent(applicantId)}`, { method: 'PATCH', body: { status } })
}

// --- "My applications": the signed-in user's applications across all jobs ---

/** Opaque position in the list, passed back to fetch the page after it. */
export type ApplicationCursor = number

/**
 * One page of the user's applications (optionally only one status), newest first, each with
 * its job.
 */
export async function fetchMyApplications(
  pageSize: number,
  after: ApplicationCursor | null = null,
  status: ApplicationStatus | null = null
) {
  const offset = after ?? 0
  const page = await api<{ items: MyApplication[], hasMore: boolean }>('/api/me/applications', {
    query: { status: status ?? undefined, offset, limit: pageSize }
  })
  const items: MyApplication[] = page.items.map(item => ({
    jobId: item.jobId,
    application: reviveApplication(item.application),
    job: item.job ? reviveJob(item.job) : null
  }))
  return { items, cursor: items.length ? offset + items.length : null, hasMore: page.hasMore }
}

/** Number of the user's applications, optionally only one status. */
export async function countMyApplications(status: ApplicationStatus | null = null) {
  const { count } = await api<{ count: number }>('/api/me/applications/count', { query: { status: status ?? undefined } })
  return count
}
