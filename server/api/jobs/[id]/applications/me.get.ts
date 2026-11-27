/** GET /api/jobs/:id/applications/me — the user's own application to a job, or null. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const [row] = await db()`select * from applications where job_id = ${id} and applicant = ${user.uid}`
  return { application: row ? applicationFromRow(row) : null }
})
