import type { H3Event } from 'h3'
import { JOB_SORTS, type JobSort } from '#shared/utils/jobs'

/** Order per sort. Jobs without a budget come last in both budget sorts; ties go newest first. */
const ORDER_BY: Record<JobSort, string> = {
  newest: 'created_at desc, id desc',
  oldest: 'created_at asc, id asc',
  budgetHigh: 'budget_amount desc nulls last, created_at desc, id desc',
  budgetLow: 'budget_amount asc nulls last, created_at desc, id desc'
}

export function jobOrderBy(sort: unknown) {
  return ORDER_BY[(JOB_SORTS as readonly unknown[]).includes(sort) ? sort as JobSort : 'newest']
}

/**
 * `where` clause and parameters for a job list or count, from the query string:
 * - `scope=mine`: the user's own jobs (any status); `scope=open`: every open job.
 * - `tags=a,b`: jobs with any of these tags.
 * - `country=PL`: jobs in that country; `city=Kraków`: jobs in that city (ignoring case).
 * Filters combine: a job must match all that are given.
 */
export function jobListFilter(event: H3Event, user: AuthUser) {
  const query = getQuery(event)
  const params: unknown[] = []
  const where: string[] = []

  if (query.scope === 'mine') {
    params.push(user.uid)
    where.push(`owner = $${params.length}`)
  } else if (query.scope === 'open') {
    params.push('open')
    where.push(`status = $${params.length}`)
  } else {
    badRequest('scope must be "mine" or "open"')
  }

  const tags = normalizeTags(String(query.tags ?? '').split(','), MAX_FILTER_TAGS)
  if (tags.length) {
    params.push(tags)
    where.push(`tags && $${params.length}::text[]`)
  }
  if (query.country !== undefined) {
    if (!isCountryCode(query.country)) badRequest('Unknown country')
    params.push(query.country)
    where.push(`country = $${params.length}`)
  }
  const city = normalizeCity(query.city)
  if (city) {
    params.push(cityKey(city))
    where.push(`city_key = $${params.length}`)
  }
  return { where: where.join(' and '), params }
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** A random 20-character id in the same format as Firestore's auto ids (which moved jobs keep). */
export function newJobId() {
  // 248 = 62 * 4: rejecting larger bytes keeps every character equally likely.
  let id = ''
  while (id.length < 20) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < 248 && id.length < 20) id += ID_ALPHABET[byte % 62]
    }
  }
  return id
}

/** Column values for a job's editable fields. */
export function jobColumns(job: NewJob) {
  return {
    title: job.title,
    description: job.description,
    tags: job.tags,
    country: job.country,
    city: job.city,
    cityKey: job.city === null ? null : cityKey(job.city),
    budgetAmount: job.budget?.amount ?? null,
    budgetCurrency: job.budget?.currency ?? null
  }
}

/** The job in the request body, validated; 400 if it isn't a valid job. */
export async function readJobBody(event: H3Event) {
  const job = parseNewJob(await readBody(event))
  if (!job) badRequest('Invalid job')
  return job
}
