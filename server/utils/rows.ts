import type { Row } from './db'

// Database rows → the shapes in shared/utils. Dates go out as ISO strings in JSON; the app
// turns them back into Dates (app/utils/api.ts).

export function jobFromRow(r: Row, prefix = ''): Job {
  const amount = r[`${prefix}budget_amount`]
  return {
    id: r[`${prefix}id`],
    owner: r[`${prefix}owner`],
    title: r[`${prefix}title`],
    tags: r[`${prefix}tags`],
    description: r[`${prefix}description`],
    country: r[`${prefix}country`],
    locations: r[`${prefix}locations`],
    // bigint arrives as a string.
    budget: amount === null ? null : { amount: Number(amount), currency: r[`${prefix}budget_currency`] },
    status: r[`${prefix}status`],
    createdAt: r[`${prefix}created_at`]
  }
}

export function applicationFromRow(r: Row): Application {
  return {
    applicant: r.applicant,
    name: r.name,
    email: r.email,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    decidedAt: r.decided_at
  }
}

/** Columns of `jobs`, for selecting a job joined to another table as `job_<column>`. */
export const JOB_COLUMNS = ['id', 'owner', 'title', 'tags', 'description', 'country', 'locations', 'budget_amount', 'budget_currency', 'status', 'created_at']

/** `j.id as job_id, j.owner as job_owner, …` for a join on `jobs j`. */
export const PREFIXED_JOB_COLUMNS = JOB_COLUMNS.map(c => `j.${c} as job_${c}`).join(', ')

/** Integer query parameter in [min, max], or `fallback` when missing or invalid. */
export function intParam(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function notFound(): never {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

export function badRequest(message = 'Invalid request'): never {
  throw createError({ statusCode: 400, statusMessage: message })
}
