/** Locale-aware formatting for job budgets, locations and dates. Call in component setup. */
export function useJobFormat() {
  const { t, locale } = useI18n()

  const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }))

  function formatBudget(budget: Job['budget']) {
    if (!budget) return t('jobs.list.noBudget')
    return new Intl.NumberFormat(locale.value, { style: 'currency', currency: budget.currency, maximumFractionDigits: 0 }).format(budget.amount)
  }

  function formatLocation(location: JobLocation) {
    const mode = t(`jobs.location.${location.mode}`)
    return location.city ? `${location.city} · ${mode}` : mode
  }

  function formatDate(date: Date) {
    return dateFormat.value.format(date)
  }

  const relativeFormat = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))
  const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]
  ]

  /** "5 minutes ago", "yesterday", "now"… */
  function formatRelative(date: Date) {
    const seconds = (date.getTime() - Date.now()) / 1000
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return relativeFormat.value.format(Math.round(seconds / size), unit)
    }
    return relativeFormat.value.format(0, 'second')
  }

  return { formatBudget, formatLocation, formatDate, formatRelative }
}
