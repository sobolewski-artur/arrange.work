import type { WatchSource } from 'vue'

export const JOB_PAGE_SIZE = 20

/**
 * State for a paged job list ("My jobs", "Find work"): tag and location filters and a sort, all
 * kept in the URL (?tags=seo,logo&locations=Kraków&sort=budgetHigh) so they survive reloads and Back, plus cursor
 * pagination and the total count. Call in page setup.
 *
 * `scope` returns which jobs to list, or null while that isn't known yet (no signed-in user);
 * the first page loads as soon as it's non-null. `beforeLoad` runs before every page load.
 */
export function useJobList(options: {
  scope: () => JobScope | null
  beforeLoad?: () => Promise<void> | void
  /** Called whenever the filter or sort changes and the list starts again from page 1. */
  onReset?: () => void
}) {
  const route = useRoute()
  const router = useRouter()

  const jobs = shallowRef<Job[]>([])
  const pageIndex = ref(0)
  // cursors[i] is where page i starts (null for the first page). Firestore pages by cursor,
  // so pages are reached one step at a time with Previous / Next.
  const cursors = shallowRef<(JobCursor | null)[]>([null])
  const hasMore = ref(false)
  const total = ref<number | null>(null)
  const loading = ref(true)
  const failed = ref(false)

  // --- Tag filter ---

  const filterTags = computed(() => normalizeTags(String(route.query.tags ?? '').split(','), MAX_FILTER_TAGS))
  /** What the filter box shows; pushed to the URL whenever it changes. */
  const filterDraft = ref<string[]>([...filterTags.value])

  function toggleFilterTag(tag: string) {
    filterDraft.value = filterDraft.value.includes(tag)
      ? filterDraft.value.filter(t => t !== tag)
      : normalizeTags([...filterDraft.value, tag], MAX_FILTER_TAGS)
  }

  // --- Location filter (?locations=Kraków,Gdańsk), used by "Find work" ---

  const filterLocations = computed(() => normalizeLocations(String(route.query.locations ?? '').split(','), MAX_FILTER_LOCATIONS))
  /** What the location box shows; pushed to the URL whenever it changes. */
  const locationDraft = ref<string[]>([...filterLocations.value])

  // One watcher for both filters, so changing both at once (e.g. "Clear filters") is a single
  // URL update; two separate replaces would race and the second would restore the first.
  watch([filterDraft, locationDraft], ([tags, cities]) => {
    if (tags.join(',') === filterTags.value.join(',') && cities.join(',') === filterLocations.value.join(',')) return
    router.replace({
      query: {
        ...route.query,
        tags: tags.length ? tags.join(',') : undefined,
        locations: cities.length ? cities.join(',') : undefined
      }
    })
  })

  const filterActive = computed(() => filterTags.value.length > 0 || filterLocations.value.length > 0)

  function clearFilters() {
    filterDraft.value = []
    locationDraft.value = []
  }

  // --- Sort ("newest" is the default and left out of the URL) ---

  const sort = computed<JobSort>(() => {
    const value = String(route.query.sort ?? '')
    return (JOB_SORTS as readonly string[]).includes(value) ? value as JobSort : 'newest'
  })

  function setSort(value: string) {
    router.replace({ query: { ...route.query, sort: value === 'newest' ? undefined : value } })
  }

  // --- Loading ---

  // Each load gets a number; a response for an older filter, sort or page is ignored.
  let latestLoad = 0
  let latestCount = 0

  async function loadPage(index: number) {
    const scope = options.scope()
    if (!scope) return
    const load = ++latestLoad
    loading.value = true
    failed.value = false
    try {
      await options.beforeLoad?.()
      const page = await fetchJobs(scope, JOB_PAGE_SIZE, cursors.value[index] ?? null, filterTags.value, sort.value, filterLocations.value)
      if (load !== latestLoad) return
      jobs.value = page.jobs
      hasMore.value = page.hasMore
      pageIndex.value = index
      if (page.cursor) {
        const next = cursors.value.slice(0, index + 1)
        next[index + 1] = page.cursor
        cursors.value = next
      }
    } catch (e) {
      if (load !== latestLoad) return
      console.error(e)
      failed.value = true
    } finally {
      if (load === latestLoad) loading.value = false
    }
  }

  async function loadCount() {
    const scope = options.scope()
    if (!scope) return
    const load = ++latestCount
    try {
      const count = await countJobs(scope, filterTags.value, filterLocations.value)
      if (load === latestCount) total.value = count
    } catch (e) {
      // The count is only for the "1–20 of 57" label; the list works without it.
      console.warn(e)
    }
  }

  // Load once the scope is known (i.e. the signed-in user has resolved).
  const started = ref(false)
  watch(() => options.scope() !== null, (ready) => {
    if (!ready || started.value) return
    started.value = true
    loadPage(0)
    loadCount()
  }, { immediate: true })

  // A new filter or sort starts again from the first page.
  const resetKey: WatchSource<string> = () => `${filterTags.value.join(',')}|${filterLocations.value.join(',')}|${sort.value}`
  watch(resetKey, () => {
    filterDraft.value = [...filterTags.value]
    locationDraft.value = [...filterLocations.value]
    if (!started.value) return
    cursors.value = [null]
    pageIndex.value = 0
    total.value = null
    options.onReset?.()
    loadPage(0)
    loadCount()
  })

  /** Loads another page, then scrolls `scrollTo` (e.g. the list heading) into view. */
  async function goTo(index: number, scrollTo?: HTMLElement | null) {
    if (loading.value || index < 0) return
    await loadPage(index)
    if (!failed.value) scrollTo?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  /** After deleting a job on this page: fix the count and reload, stepping back if it's now empty. */
  async function afterRemove() {
    if (total.value !== null) total.value = Math.max(0, total.value - 1)
    await loadPage(jobs.value.length === 1 && pageIndex.value > 0 ? pageIndex.value - 1 : pageIndex.value)
  }

  const pages = computed(() => total.value === null ? null : Math.max(1, Math.ceil(total.value / JOB_PAGE_SIZE)))
  const rangeFrom = computed(() => pageIndex.value * JOB_PAGE_SIZE + 1)
  const rangeTo = computed(() => pageIndex.value * JOB_PAGE_SIZE + jobs.value.length)

  return {
    jobs,
    pageIndex,
    hasMore,
    total,
    loading,
    failed,
    filterTags,
    filterActive,
    filterDraft,
    toggleFilterTag,
    filterLocations,
    locationDraft,
    clearFilters,
    sort,
    setSort,
    loadPage,
    goTo,
    afterRemove,
    pages,
    rangeFrom,
    rangeTo
  }
}
