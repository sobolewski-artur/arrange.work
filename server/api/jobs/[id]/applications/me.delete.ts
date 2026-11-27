/** DELETE /api/jobs/:id/applications/me — withdraws the user's application (no-op if there is none). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  await db()`delete from applications where job_id = ${id} and applicant = ${user.uid}`
  setResponseStatus(event, 204)
  return null
})
