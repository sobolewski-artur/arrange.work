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

  return { formatBudget, formatLocation, formatDate }
}
