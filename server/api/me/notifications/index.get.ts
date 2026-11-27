/**
 * GET /api/me/notifications — the user's latest notifications (new applications to their jobs,
 * and decisions on their own applications), newest first, plus when they last opened the list.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  // Both queries in one round trip.
  const [rows = [], seen = []] = await db().transaction(tx => [
    tx`
      (select 'applied' as kind, a.job_id, a.applicant, j.title as job_title, a.name, a.created_at as at
       from applications a join jobs j on j.id = a.job_id
       where j.owner = ${user.uid}
       order by a.created_at desc limit ${MAX_NOTIFICATIONS})
      union all
      (select a.status as kind, a.job_id, a.applicant, j.title as job_title, a.name, a.decided_at as at
       from applications a join jobs j on j.id = a.job_id
       where a.applicant = ${user.uid} and a.decided_at is not null
       order by a.decided_at desc limit ${MAX_NOTIFICATIONS})
      order by at desc limit ${MAX_NOTIFICATIONS}
    `,
    tx`select notifications_seen_at from users where uid = ${user.uid}`
  ], { readOnly: true })

  const notifications: AppNotification[] = rows.map(r => ({
    id: `${r.kind}:${r.job_id}/${r.applicant}`,
    kind: r.kind,
    jobId: r.job_id,
    jobTitle: r.job_title,
    name: r.name,
    at: r.at
  }))
  return { notifications, seenAt: (seen[0]?.notifications_seen_at ?? null) as Date | null }
})
