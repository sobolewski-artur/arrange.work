/** GET /api/jobs/:id/applications — applications to one of the user's jobs, oldest first (404 if not theirs). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const [job] = await db()`select 1 from jobs where id = ${id} and owner = ${user.uid}`
  if (!job) notFound()
  const rows = await db()`
    select * from applications where job_id = ${id}
    order by created_at asc, applicant asc
    limit ${MAX_LISTED_APPLICATIONS}
  `
  return rows.map(applicationFromRow)
})
