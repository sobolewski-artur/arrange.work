<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'

definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('jobs.new.title') })

const submitting = ref(false)
const error = ref<string | null>(null)
/** Title of the job just posted; switches the page to the confirmation. */
const postedTitle = ref<string | null>(null)
/** Bumped to remount (and so clear) the form. */
const formKey = ref(0)

async function submit(job: NewJob) {
  const u = user.value
  if (!u) return
  submitting.value = true
  error.value = null
  try {
    await postJob(u, job)
    postedTitle.value = job.title
  } catch (e) {
    console.error(e)
    const code = (e as FirebaseError).code
    error.value = code === 'unavailable' ? t('auth.errors.network') : t('jobs.new.errors.failed')
  } finally {
    submitting.value = false
  }
}

function postAnother() {
  formKey.value++
  postedTitle.value = null
}

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="flex justify-center px-4 py-12 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
      <!-- Confirmation -->
      <div v-if="postedTitle" class="py-6 text-center" role="status">
        <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-success-line">
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 class="mt-5 text-2xl font-bold tracking-tight">{{ $t('jobs.new.posted.title') }}</h1>
        <p class="mt-2 text-pretty text-muted">{{ $t('jobs.new.posted.text', { title: postedTitle }) }}</p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <NuxtLink :to="localePath('/jobs')" :class="primaryButton">{{ $t('jobs.new.posted.viewJobs') }}</NuxtLink>
          <button type="button" :class="secondaryButton" @click="postAnother">{{ $t('jobs.new.posted.another') }}</button>
        </div>
      </div>

      <!-- Form -->
      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('jobs.new.title') }}</h1>
        <p class="mt-1 text-sm text-pretty text-muted">{{ $t('jobs.new.subtitle') }}</p>
        <JobForm
          :key="formKey"
          class="mt-8"
          :submit-label="$t('jobs.new.submit')"
          :cancel-to="localePath('/')"
          :submitting="submitting"
          :error="error"
          @submit="submit"
        />
      </template>
    </div>
  </div>
</template>
