/**
 * PATCH /api/jobs/:id/applications/:applicant  { status }
 * Accepts or rejects an application to one of the user's jobs, or puts it back to pending.
 * Returns the decision time (null for pending). 404 if the job isn't theirs.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const applicant = getRouterParam(event, 'applicant')
  const { status } = (await readBody<{ status?: unknown }>(event)) ?? {}
  if (!isApplicationStatus(status)) badRequest('Invalid status')

  const rows = await db()`
    update applications a
    set status = ${status}, decided_at = case when ${status} = 'pending' then null else now() end
    from jobs j
    where a.job_id = ${id} and a.applicant = ${applicant} and j.id = a.job_id and j.owner = ${user.uid}
    returning a.decided_at
  `
  if (!rows.length) notFound()
  return { decidedAt: rows[0]!.decided_at as Date | null }
})
