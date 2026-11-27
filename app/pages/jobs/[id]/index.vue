<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useCurrentUser()
const { formatBudget, formatLocation, formatDate } = useJobFormat()

const jobId = computed(() => String(route.params.id))

const job = shallowRef<Job | null>(null)
const state = ref<'loading' | 'ready' | 'notFound' | 'failed'>('loading')
const isOwner = computed(() => !!job.value && job.value.owner === user.value?.uid)

useHead({ title: () => job.value?.title ?? t('jobs.details.title') })

// The owner sees the applications; anyone else sees their own application (if any).
const applications = shallowRef<Application[]>([])
const applicationsState = ref<'loading' | 'ready' | 'failed'>('loading')
const myApplication = shallowRef<Application | null>(null)

async function load() {
  const u = user.value
  if (!u) return
  state.value = 'loading'
  try {
    const found = await fetchJob(jobId.value)
    job.value = found
    if (!found) {
      state.value = 'notFound'
      return
    }
    if (found.owner === u.uid) loadApplications()
    else myApplication.value = await fetchMyApplication(found.id)
    state.value = 'ready'
  } catch (e) {
    console.error(e)
    state.value = 'failed'
  }
}

async function loadApplications() {
  applicationsState.value = 'loading'
  try {
    applications.value = await fetchApplications(jobId.value)
    applicationsState.value = 'ready'
  } catch (e) {
    console.error(e)
    applicationsState.value = 'failed'
  }
}

watch([user, jobId], ([u]) => {
  if (u) load()
}, { immediate: true })

// --- Owner: accepting and rejecting applications ---

const decidingId = ref<string | null>(null)
const decideError = ref<{ id: string, message: string } | null>(null)

async function decide(application: Application, status: ApplicationStatus) {
  if (!job.value || decidingId.value) return
  decidingId.value = application.applicant
  decideError.value = null
  try {
    await setApplicationStatus(job.value.id, application.applicant, status)
    applications.value = applications.value.map(a => a.applicant === application.applicant
      ? { ...a, status, decidedAt: status === 'pending' ? null : new Date() }
      : a)
  } catch (e) {
    console.error(e)
    decideError.value = { id: application.applicant, message: t('jobs.details.errors.decide') }
  } finally {
    decidingId.value = null
  }
}

const statusCounts = computed(() => Object.fromEntries(
  APPLICATION_STATUSES.map(status => [status, applications.value.filter(a => a.status === status).length])
) as Record<ApplicationStatus, number>)

const statusBadge: Record<ApplicationStatus, string> = {
  pending: 'bg-well text-muted',
  accepted: 'bg-success-soft text-success ring-1 ring-success-line',
  rejected: 'bg-danger-soft text-danger ring-1 ring-danger-line'
}

// --- Applying ---

const formOpen = ref(false)
const message = ref('')
const sending = ref(false)
const applyError = ref<string | null>(null)
const messageInput = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() => !sending.value && message.value.trim() !== '')

async function openForm() {
  formOpen.value = true
  applyError.value = null
  await nextTick()
  messageInput.value?.focus()
}

async function apply() {
  const u = user.value
  if (!u || !job.value || !canSend.value) return
  sending.value = true
  applyError.value = null
  try {
    await applyToJob(u, job.value, message.value.trim())
    myApplication.value = await fetchMyApplication(job.value.id)
    formOpen.value = false
    message.value = ''
  } catch (e) {
    console.error(e)
    applyError.value = isNetworkError(e) ? t('auth.errors.network') : t('jobs.details.errors.apply')
  } finally {
    sending.value = false
  }
}

const confirmingWithdraw = ref(false)
const withdrawing = ref(false)
const withdrawError = ref<string | null>(null)

async function withdraw() {
  if (!user.value || !job.value || withdrawing.value) return
  withdrawing.value = true
  withdrawError.value = null
  try {
    await withdrawApplication(job.value.id)
    myApplication.value = null
    confirmingWithdraw.value = false
  } catch (e) {
    console.error(e)
    withdrawError.value = t('jobs.details.errors.withdraw')
  } finally {
    withdrawing.value = false
  }
}

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60'
const card = 'rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8'
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <template v-if="user">
      <NuxtLink :to="localePath(isOwner ? '/jobs' : '/find-work')" class="text-sm text-muted hover:text-fg">
        ← {{ isOwner ? $t('nav.myJobs') : $t('nav.findWork') }}
      </NuxtLink>

      <div v-if="state === 'loading'" class="mt-6 animate-pulse" :class="card" aria-busy="true">
        <div class="h-4 w-32 rounded bg-well" />
        <div class="mt-5 h-8 w-2/3 rounded bg-well" />
        <div class="mt-4 h-4 w-1/2 rounded bg-well" />
        <div class="mt-8 h-24 rounded bg-well" />
      </div>

      <div v-else-if="state === 'notFound'" class="mt-6 text-center" :class="card">
        <h1 class="text-xl font-bold tracking-tight">{{ $t('jobs.edit.notFound.title') }}</h1>
        <p class="mt-2 text-muted">{{ $t('jobs.edit.notFound.text') }}</p>
        <NuxtLink :to="localePath('/find-work')" :class="[secondaryButton, 'mt-6']">{{ $t('nav.findWork') }}</NuxtLink>
      </div>

      <div v-else-if="state === 'failed'" role="alert" class="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('jobs.details.errors.load') }}
        <button type="button" :class="secondaryButton" class="text-fg" @click="load">{{ $t('jobs.list.errors.retry') }}</button>
      </div>

      <template v-else-if="job">
        <!-- The job -->
        <article class="mt-6" :class="card">
          <div class="flex items-start justify-between gap-3">
            <ul v-if="job.tags.length" class="flex min-w-0 flex-wrap gap-1.5" :aria-label="$t('jobs.new.fields.tags')">
              <li v-for="tag in job.tags" :key="tag" class="min-w-0 max-w-full">
                <!-- A tag opens Find work filtered by it. -->
                <NuxtLink
                  :to="localePath({ path: '/find-work', query: { tags: tag } })"
                  class="block max-w-full truncate rounded-full bg-well px-2.5 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
                  :title="$t('jobs.list.filter.byTag', { tag })"
                >
                  {{ tag }}
                </NuxtLink>
              </li>
            </ul>
            <div class="ml-auto flex shrink-0 items-center gap-1.5">
              <span v-if="isOwner" class="rounded-full bg-well px-2.5 py-0.5 text-xs font-medium text-muted">{{ $t('jobs.browse.yourJob') }}</span>
              <span class="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success-line">
                {{ $t(`jobs.list.status.${job.status}`) }}
              </span>
            </div>
          </div>

          <h1 class="mt-4 text-2xl font-bold tracking-tight break-words sm:text-3xl">{{ job.title }}</h1>

          <dl class="mt-5 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-muted">{{ $t('jobs.new.fields.budget') }}</dt>
              <dd class="mt-0.5 font-semibold">{{ formatBudget(job.budget) }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ $t('jobs.details.location') }}</dt>
              <dd class="mt-0.5 font-semibold">{{ formatLocation(job) || '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ $t('jobs.details.posted') }}</dt>
              <dd class="mt-0.5 font-semibold">{{ job.createdAt ? formatDate(job.createdAt) : '—' }}</dd>
            </div>
          </dl>

          <h2 class="mt-6 text-sm font-semibold">{{ $t('jobs.new.fields.description') }}</h2>
          <p class="mt-2 break-words whitespace-pre-line text-muted">{{ job.description }}</p>
        </article>

        <!-- Owner: applications -->
        <section v-if="isOwner" class="mt-6" :class="card" aria-labelledby="applications-title">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="applications-title" class="text-lg font-semibold">
              {{ $t('jobs.details.applications.title') }}
              <span v-if="applicationsState === 'ready'" class="font-normal text-muted">({{ applications.length }})</span>
            </h2>
            <NuxtLink :to="localePath(`/jobs/${job.id}/edit`)" :class="secondaryButton">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                <path d="m13.5 6.5 4 4" />
              </svg>
              {{ $t('jobs.edit.title') }}
            </NuxtLink>
          </div>

          <p v-if="applicationsState === 'ready' && applications.length > 0" class="mt-1 text-sm text-muted">
            {{ $t('jobs.details.applications.summary', statusCounts) }}
          </p>

          <p v-if="applicationsState === 'loading'" class="mt-4 text-sm text-muted">{{ $t('auth.pending') }}</p>
          <div v-else-if="applicationsState === 'failed'" role="alert" class="mt-4 flex flex-wrap items-center gap-3 text-sm text-danger">
            {{ $t('jobs.details.errors.applications') }}
            <button type="button" class="font-medium text-fg underline-offset-4 hover:underline" @click="loadApplications">{{ $t('jobs.list.errors.retry') }}</button>
          </div>
          <p v-else-if="applications.length === 0" class="mt-4 text-sm text-muted">{{ $t('jobs.details.applications.empty') }}</p>
          <ul v-else class="mt-4 divide-y divide-line">
            <li v-for="application in applications" :key="application.applicant" class="py-4 first:pt-0 last:pb-0">
              <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p class="font-medium break-words">{{ application.name }}</p>
                <div class="flex items-center gap-2">
                  <span v-if="application.createdAt" class="text-xs text-subtle">{{ formatDate(application.createdAt) }}</span>
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statusBadge[application.status]">
                    {{ $t(`jobs.details.status.${application.status}`) }}
                  </span>
                </div>
              </div>
              <a :href="`mailto:${application.email}`" class="text-sm break-all text-muted underline-offset-4 hover:text-fg hover:underline">{{ application.email }}</a>
              <p class="mt-2 text-sm break-words whitespace-pre-line">{{ application.message }}</p>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <template v-if="application.status === 'pending'">
                  <button
                    type="button"
                    class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
                    :aria-label="$t('jobs.details.applications.acceptFrom', { name: application.name })"
                    :disabled="decidingId !== null"
                    @click="decide(application, 'accepted')"
                  >
                    {{ $t('jobs.details.applications.accept') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-danger ring-1 ring-line-strong transition hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
                    :aria-label="$t('jobs.details.applications.rejectFrom', { name: application.name })"
                    :disabled="decidingId !== null"
                    @click="decide(application, 'rejected')"
                  >
                    {{ $t('jobs.details.applications.reject') }}
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  class="text-sm font-medium text-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-60"
                  :aria-label="$t('jobs.details.applications.undoFor', { name: application.name })"
                  :disabled="decidingId !== null"
                  @click="decide(application, 'pending')"
                >
                  {{ $t('jobs.details.applications.undo') }}
                </button>
                <span v-if="decidingId === application.applicant" class="text-sm text-muted" aria-live="polite">{{ $t('auth.pending') }}</span>
              </div>
              <p v-if="decideError?.id === application.applicant" role="alert" class="mt-2 text-sm text-danger">{{ decideError.message }}</p>
            </li>
          </ul>
        </section>

        <!-- Specialist: apply, or their application -->
        <section v-else class="mt-6" :class="card" aria-labelledby="apply-title">
          <!-- Already applied -->
          <template v-if="myApplication">
            <div class="flex items-start gap-3">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full"
                :class="myApplication.status === 'rejected' ? 'bg-danger-soft text-danger ring-1 ring-danger-line' : myApplication.status === 'accepted' ? 'bg-success-soft text-success ring-1 ring-success-line' : 'bg-well text-muted'"
              >
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path v-if="myApplication.status === 'rejected'" d="M18 6 6 18M6 6l12 12" />
                  <path v-else-if="myApplication.status === 'accepted'" d="M20 6 9 17l-5-5" />
                  <template v-else>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </template>
                </svg>
              </span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 id="apply-title" class="text-lg font-semibold">{{ $t(`jobs.details.applied.title.${myApplication.status}`) }}</h2>
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statusBadge[myApplication.status]">
                    {{ $t(`jobs.details.status.${myApplication.status}`) }}
                  </span>
                </div>
                <p class="text-sm text-muted">{{ $t(`jobs.details.applied.text.${myApplication.status}`) }}</p>
                <p class="mt-1 text-xs text-subtle">
                  {{ myApplication.createdAt ? $t('jobs.details.applied.on', { date: formatDate(myApplication.createdAt) }) : '' }}
                  {{ $t('jobs.details.applied.shared') }}
                </p>
              </div>
            </div>
            <blockquote class="mt-4 rounded-xl bg-well p-4 text-sm break-words whitespace-pre-line">{{ myApplication.message }}</blockquote>

            <div v-if="!confirmingWithdraw" class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" class="text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline" @click="confirmingWithdraw = true">
                {{ $t('jobs.details.withdraw') }}
              </button>
              <NuxtLink :to="localePath('/applications')" class="text-sm font-medium underline-offset-4 hover:underline">
                {{ $t('applications.viewAll') }} →
              </NuxtLink>
            </div>
            <div v-else class="mt-4 flex flex-col gap-3 rounded-xl bg-danger-soft p-3 ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-danger">{{ withdrawError ?? $t('jobs.details.confirmWithdraw') }}</p>
              <div class="flex shrink-0 gap-2">
                <button
                  type="button"
                  class="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover disabled:opacity-60"
                  :disabled="withdrawing"
                  @click="confirmingWithdraw = false; withdrawError = null"
                >
                  {{ $t('account.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-page transition hover:opacity-90 disabled:opacity-60"
                  :disabled="withdrawing"
                  @click="withdraw"
                >
                  {{ withdrawing ? $t('auth.pending') : $t('jobs.details.withdraw') }}
                </button>
              </div>
            </div>
          </template>

          <!-- Not open any more -->
          <p v-else-if="job.status !== 'open'" id="apply-title" class="text-muted">{{ $t('jobs.details.closed') }}</p>

          <!-- Apply -->
          <template v-else-if="!formOpen">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="apply-title" class="text-lg font-semibold">{{ $t('jobs.details.apply.title') }}</h2>
                <p class="text-sm text-muted">{{ $t('jobs.details.apply.text') }}</p>
              </div>
              <button type="button" :class="[primaryButton, 'shrink-0']" @click="openForm">{{ $t('jobs.details.apply.button') }}</button>
            </div>
          </template>

          <form v-else @submit.prevent="apply">
            <h2 id="apply-title" class="text-lg font-semibold">{{ $t('jobs.details.apply.title') }}</h2>
            <div class="mt-4 flex items-baseline justify-between gap-4">
              <label for="application-message" class="text-sm font-medium">{{ $t('jobs.details.apply.message') }}</label>
              <span class="text-xs text-subtle tabular-nums" aria-hidden="true">{{ message.length }} / {{ MAX_APPLICATION_MESSAGE_LENGTH }}</span>
            </div>
            <textarea
              id="application-message"
              ref="messageInput"
              v-model="message"
              required
              rows="6"
              :maxlength="MAX_APPLICATION_MESSAGE_LENGTH"
              :placeholder="$t('jobs.details.apply.placeholder')"
              :disabled="sending"
              aria-describedby="application-note"
              class="mt-1 block w-full resize-y rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line-strong placeholder:text-subtle focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60"
            />
            <p id="application-note" class="mt-1 text-xs text-muted">{{ $t('jobs.details.apply.note') }}</p>
            <p v-if="applyError" role="alert" class="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-line">{{ applyError }}</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" :class="secondaryButton" :disabled="sending" @click="formOpen = false">{{ $t('account.cancel') }}</button>
              <button type="submit" :class="primaryButton" :disabled="!canSend">
                {{ sending ? $t('auth.pending') : $t('jobs.details.apply.send') }}
              </button>
            </div>
          </form>
        </section>
      </template>
    </template>
  </div>
</template>
