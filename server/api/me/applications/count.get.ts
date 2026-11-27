/** GET /api/me/applications/count?status=… — how many applications the user has (optionally one status). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { status } = getQuery(event)
  const filter = isApplicationStatus(status) ? status : null
  const [row] = await db()`
    select count(*)::int as count from applications
    where applicant = ${user.uid} and (${filter}::text is null or status = ${filter})
  `
  return { count: row!.count as number }
})
