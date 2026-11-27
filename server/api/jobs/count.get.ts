/** GET /api/jobs/count?scope=…&tags=…&country=…&city=… — how many jobs the same list has in total. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { where, params } = jobListFilter(event, user)
  const [row] = await db().query(`select count(*)::int as count from jobs where ${where}`, params)
  return { count: row!.count as number }
})
