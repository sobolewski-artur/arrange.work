interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | undefined>
  /** Sent as JSON; a Blob is sent as-is with its own type. */
  body?: unknown
}

/**
 * Calls the app's own API (server/api) as the signed-in user. The browser sends their Neon Auth
 * session cookie with these same-origin requests, so there's no token to attach. Client-only.
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body instanceof Blob) headers['Content-Type'] = options.body.type
  return $fetch<T>(path, {
    method: options.method,
    query: options.query,
    body: options.body as BodyInit | Record<string, unknown> | undefined,
    headers
  }) as Promise<T>
}

/** What $fetch throws for a failed request. */
interface FetchFailure { name?: string, statusCode?: number, response?: unknown }

/** The request reached the server, which answered 404 (missing, or not the user's to see). */
export function isNotFound(e: unknown) {
  return (e as FetchFailure)?.statusCode === 404
}

/** The request never got an answer (offline, DNS, server down). */
export function isNetworkError(e: unknown) {
  const err = e as FetchFailure
  return err?.name === 'FetchError' && !err.response
}

/** `value` (an ISO string from JSON) as a Date, or null. */
export function toDate(value: unknown): Date | null {
  return typeof value === 'string' || value instanceof Date ? new Date(value) : null
}

/** Revives the dates in a job from the API. */
export function reviveJob(job: Job): Job {
  return { ...job, createdAt: toDate(job.createdAt) }
}

/** Revives the dates in an application from the API. */
export function reviveApplication(application: Application): Application {
  return { ...application, createdAt: toDate(application.createdAt), decidedAt: toDate(application.decidedAt) }
}
