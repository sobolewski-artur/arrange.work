/**
 * GET /api/jobs?scope=mine|open&tags=…&country=…&city=…&sort=…&offset=0&limit=20
 * One page of jobs (see jobListFilter for the filters). `hasMore` says whether another page exists.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { where, params } = jobListFilter(event, user)
  const query = getQuery(event)
  const limit = intParam(query.limit, 20, 1, MAX_JOB_PAGE_SIZE)
  const offset = intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

  // One extra row tells whether there's another page.
  const rows = await db().query(
    `select * from jobs where ${where} order by ${jobOrderBy(query.sort)} limit ${limit + 1} offset ${offset}`,
    params
  )
  return { jobs: rows.slice(0, limit).map(r => jobFromRow(r)), hasMore: rows.length > limit }
})
