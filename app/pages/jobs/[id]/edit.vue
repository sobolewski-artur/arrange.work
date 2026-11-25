<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'

definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useCurrentUser()

useHead({ title: () => t('jobs.edit.title') })

const jobId = computed(() => String(route.params.id))

const job = shallowRef<Job | null>(null)
const state = ref<'loading' | 'ready' | 'notFound' | 'failed'>('loading')

async function load() {
  const u = user.value
  if (!u) return
  state.value = 'loading'
  try {
    await ensureLegacyJobsMoved(u)
    job.value = await fetchMyJob(u, jobId.value)
    state.value = job.value ? 'ready' : 'notFound'
  } catch (e) {
    console.error(e)
    state.value = 'failed'
  }
}

watch([user, jobId], ([u]) => {
  if (u) load()
}, { immediate: true })

const submitting = ref(false)
const error = ref<string | null>(null)

async function save(updated: NewJob) {
  const u = user.value
  if (!u) return
  submitting.value = true
  error.value = null
  try {
    await updateJob(jobId.value, updated)
    await navigateTo(localePath({ path: '/jobs', query: { updated: '1' } }))
  } catch (e) {
    console.error(e)
    const code = (e as FirebaseError).code
    error.value = code === 'unavailable'
      ? t('auth.errors.network')
      : code === 'not-found'
        ? t('jobs.edit.notFound.text')
        : t('jobs.edit.errors.failed')
  } finally {
    submitting.value = false
  }
}

const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="flex justify-center px-4 py-12 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
      <NuxtLink :to="localePath('/jobs')" class="text-sm text-muted hover:text-fg">
        ← {{ $t('nav.myJobs') }}
      </NuxtLink>

      <div v-if="state === 'loading'" class="mt-6 animate-pulse space-y-5" aria-busy="true">
        <div class="h-7 w-40 rounded bg-well" />
        <div v-for="n in 4" :key="n" class="h-10 rounded-lg bg-well" />
        <div class="h-32 rounded-lg bg-well" />
      </div>

      <div v-else-if="state === 'notFound'" class="py-8 text-center">
        <h1 class="text-xl font-bold tracking-tight">{{ $t('jobs.edit.notFound.title') }}</h1>
        <p class="mt-2 text-muted">{{ $t('jobs.edit.notFound.text') }}</p>
        <NuxtLink :to="localePath('/jobs')" :class="[secondaryButton, 'mt-6']">{{ $t('nav.myJobs') }}</NuxtLink>
      </div>

      <div v-else-if="state === 'failed'" role="alert" class="mt-6 flex flex-col items-start gap-3 rounded-xl bg-danger-soft p-4 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('jobs.edit.errors.load') }}
        <button type="button" :class="secondaryButton" class="text-fg" @click="load">{{ $t('jobs.list.errors.retry') }}</button>
      </div>

      <template v-else-if="job">
        <h1 class="mt-4 text-2xl font-bold tracking-tight">{{ $t('jobs.edit.title') }}</h1>
        <JobForm
          class="mt-8"
          :initial="job"
          :submit-label="$t('jobs.edit.submit')"
          :cancel-to="localePath('/jobs')"
          :submitting="submitting"
          :error="error"
          @submit="save"
        />
      </template>
    </div>
  </div>
</template>
