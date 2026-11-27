// Job fields and the rules for them, used by the app (the job form, lists) and the API
// (validating what it stores). Auto-imported in both app/ and server/.
import { isCountryCode } from './countries'
import { MAX_JOB_TAGS, normalizeTags } from './tags'

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

/** Lowercased city, for matching cities regardless of case. */
export function cityKey(city: string) {
  return city.toLocaleLowerCase()
}

export interface NewJob {
  title: string
  /** Free-text tags typed by the client (see tags.ts). The form requires at least one; jobs from before tags existed have none. */
  tags: string[]
  description: string
  /** ISO 3166-1 alpha-2 code of the country where the work happens (see countries.ts). */
  country: string
  /** Cities in that country (see normalizeLocations); may be empty ("anywhere in the country"). */
  locations: string[]
  /** Whole amount in `currency`, or null when the client didn't give a budget. */
  budget: { amount: number, currency: JobCurrency } | null
}

export interface Job extends Omit<NewJob, 'country'> {
  id: string
  /** Neon Auth user id of the user who posted the job. */
  owner: string
  status: 'open'
  /** Null for jobs posted before countries existed. */
  country: string | null
  createdAt: Date | null
}

/**
 * The job in `value` if it's a valid NewJob (as the job form sends it), cleaned up the same way
 * the form does; otherwise null.
 */
export function parseNewJob(value: unknown): NewJob | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const title = typeof v.title === 'string' ? v.title.trim() : ''
  const description = typeof v.description === 'string' ? v.description.trim() : ''
  if (!title || title.length > MAX_JOB_TITLE_LENGTH) return null
  if (!description || description.length > MAX_JOB_DESCRIPTION_LENGTH) return null
  const tags = normalizeTags(v.tags, MAX_JOB_TAGS)
  if (!tags.length) return null
  if (!isCountryCode(v.country)) return null

  let budget: NewJob['budget'] = null
  if (v.budget !== null && v.budget !== undefined) {
    const b = v.budget as Record<string, unknown>
    const amount = b.amount
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
    if (!(JOB_CURRENCIES as readonly unknown[]).includes(b.currency)) return null
    budget = { amount, currency: b.currency as JobCurrency }
  }

  return { title, tags, description, country: v.country, locations: normalizeLocations(v.locations), budget }
}

// --- Lists ---

export const JOB_SORTS = ['newest', 'oldest', 'budgetHigh', 'budgetLow'] as const
export type JobSort = typeof JOB_SORTS[number]

/** Most cities a "Find work" location filter can combine. */
export const MAX_FILTER_LOCATIONS = 3

/** Largest page of jobs the API returns. */
export const MAX_JOB_PAGE_SIZE = 50
