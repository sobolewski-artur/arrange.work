// Notification types are in shared/utils/notifications.ts; server/api/me/notifications builds
// them from applications in Postgres.

/** How often open tabs check for new notifications (also on returning to the tab). */
const POLL_MS = 30_000

export interface NotificationState {
  notifications: AppNotification[]
  /** When the user last opened their notifications (any device); null if never. */
  seenAt: Date | null
}

async function fetchNotifications(): Promise<NotificationState> {
  const state = await api<NotificationState>('/api/me/notifications')
  return {
    notifications: state.notifications.map(n => ({ ...n, at: toDate(n.at) })),
    seenAt: toDate(state.seenAt)
  }
}

/**
 * Keeps the signed-in user's notifications up to date: loads them now, then every POLL_MS while
 * the tab is visible, and right away when the tab becomes visible again. Returns a function
 * that stops it.
 */
export function watchNotifications(
  onChange: (state: NotificationState) => void,
  onError: (error: unknown) => void
): () => void {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined

  async function poll() {
    clearTimeout(timer)
    // One request at a time; a hidden tab stops polling until it's visible again.
    if (stopped || running || document.visibilityState === 'hidden') return
    running = true
    try {
      const state = await fetchNotifications()
      if (!stopped) onChange(state)
    } catch (e) {
      if (!stopped) onError(e)
    } finally {
      running = false
    }
    if (!stopped) timer = setTimeout(poll, POLL_MS)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') poll()
  }
  document.addEventListener('visibilitychange', onVisibility)
  poll()

  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** Marks everything up to now as seen. Returns the new "seen" time. */
export async function markNotificationsSeen() {
  const { seenAt } = await api<{ seenAt: string }>('/api/me/notifications/seen', { method: 'POST' })
  return new Date(seenAt)
}
