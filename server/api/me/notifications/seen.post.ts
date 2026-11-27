/** POST /api/me/notifications/seen — marks every notification up to now as seen. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [row] = await db()`
    insert into users (uid, notifications_seen_at) values (${user.uid}, now())
    on conflict (uid) do update set notifications_seen_at = excluded.notifications_seen_at
    returning notifications_seen_at
  `
  return { seenAt: row!.notifications_seen_at as Date }
})
