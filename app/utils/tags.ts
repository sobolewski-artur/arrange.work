/** Job tags are free text typed by the client, up to MAX_JOB_TAGS per job. */
export const MAX_JOB_TAGS = 5
export const MAX_TAG_LENGTH = 30

/**
 * Cleans one typed tag: drops a leading "#", collapses whitespace, lowercases (so "SEO" and
 * "seo" are the same tag, which keeps later filtering simple) and caps the length.
 * Returns '' when nothing usable is left.
 */
export function normalizeTag(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim()
}

/** Cleans a list of tags: normalized, non-empty, no duplicates, at most MAX_JOB_TAGS. */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const result: string[] = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const clean = normalizeTag(tag)
    if (clean && !result.includes(clean)) result.push(clean)
    if (result.length === MAX_JOB_TAGS) break
  }
  return result
}
