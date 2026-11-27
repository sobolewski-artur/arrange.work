/** DELETE /api/jobs/:id — deletes one of the user's jobs and, with it, its applications. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const rows = await db()`delete from jobs where id = ${id} and owner = ${user.uid} returning id`
  if (!rows.length) notFound()
  setResponseStatus(event, 204)
  return null
})
