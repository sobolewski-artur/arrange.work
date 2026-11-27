/**
 * PUT /api/jobs/:id/applications/me  { name, message }
 * Applies to an open job that isn't the user's own, sharing `name` and their verified email
 * with the job's owner. 409 if they've already applied.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ name?: unknown, message?: unknown }>(event)

  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > MAX_APPLICATION_MESSAGE_LENGTH) badRequest('Invalid message')
  const typedName = typeof body?.name === 'string' ? body.name.trim() : ''
  const name = (typedName || user.name || user.email).slice(0, MAX_APPLICANT_NAME_LENGTH)

  const [job] = await db()`select owner from jobs where id = ${id} and status = 'open'`
  if (!job) notFound()
  if (job.owner === user.uid) throw createError({ statusCode: 403, statusMessage: 'You can’t apply to your own job' })

  const rows = await db()`
    insert into applications (job_id, applicant, name, email, message)
    values (${id}, ${user.uid}, ${name}, ${user.email}, ${message})
    on conflict (job_id, applicant) do nothing
    returning *
  `
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: 'Already applied' })
  setResponseStatus(event, 201)
  return applicationFromRow(rows[0]!)
})
