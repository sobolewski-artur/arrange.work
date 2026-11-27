/**
 * GET /api/me/applications?status=…&offset=0&limit=20
 * One page of the user's applications (optionally one status), newest first, each with its job.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const status = isApplicationStatus(query.status) ? query.status : null
  const limit = intParam(query.limit, 20, 1, MAX_APPLICATION_PAGE_SIZE)
  const offset = intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

  const rows = await db().query(
    `select a.*, ${PREFIXED_JOB_COLUMNS}
     from applications a join jobs j on j.id = a.job_id
     where a.applicant = $1 and ($2::text is null or a.status = $2)
     order by a.created_at desc, a.job_id desc
     limit ${limit + 1} offset ${offset}`,
    [user.uid, status]
  )
  const items: MyApplication[] = rows.slice(0, limit).map(r => ({
    jobId: r.job_id,
    application: applicationFromRow(r),
    // Same visibility as GET /api/jobs/:id.
    job: r.job_status === 'open' || r.job_owner === user.uid ? jobFromRow(r, 'job_') : null
  }))
  return { items, hasMore: rows.length > limit }
})
