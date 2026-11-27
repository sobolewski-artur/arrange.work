/**
 * GET /api/jobs/:id — a job the user may see: any open job, and their own in any status.
 * 404 when it doesn't exist or they may not see it (the same answer, so ids can't be probed).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const [row] = await db()`select * from jobs where id = ${id} and (status = 'open' or owner = ${user.uid})`
  return row ? jobFromRow(row) : notFound()
})
