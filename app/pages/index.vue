<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useSeoMeta({
  title: () => `arrange.work – ${t('home.meta.title')}`,
  description: () => t('home.meta.description'),
  ogTitle: () => `arrange.work – ${t('home.meta.title')}`,
  ogDescription: () => t('home.meta.description')
})

const signUpPath = computed(() => localePath({ path: '/login', query: { mode: 'signup' } }))
// Signed-in users already have an account, so the main call to action is posting a job.
const startLink = computed(() => user.value
  ? { to: localePath('/jobs/new'), label: t('home.cta.postJob') }
  : { to: signUpPath.value, label: t('home.cta.start') })

const heroPoints = ['describe', 'compare', 'together'] as const

const steps = ['describe', 'compare', 'hire'] as const

// `to: null` hides the panel's button (the specialists one for signed-in users).
const audiences = computed(() => [
  { key: 'clients', points: ['find', 'rates', 'organized'], to: startLink.value.to, cta: startLink.value.label },
  { key: 'specialists', points: ['profile', 'projects', 'terms'], to: user.value ? null : signUpPath.value, cta: t('home.cta.join') }
] as const)

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-on-primary shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-3 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative isolate overflow-hidden">
      <div class="hero-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-24 lg:grid-cols-2 lg:gap-16">
        <div class="text-center lg:text-left">
          <p class="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted ring-1 ring-line">
            {{ $t('home.hero.eyebrow') }}
          </p>
          <h1 class="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl lg:mx-0 lg:text-5xl xl:text-6xl">
            {{ $t('home.hero.title') }}
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted lg:mx-0">
            {{ $t('home.hero.subtitle') }}
          </p>
          <div class="mt-10 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <NuxtLink :to="startLink.to" :class="primaryButton">{{ startLink.label }}</NuxtLink>
            <NuxtLink :to="localePath({ path: '/', hash: '#how-it-works' })" :class="secondaryButton">
              {{ $t('home.cta.howItWorks') }}
            </NuxtLink>
          </div>
          <ul class="mt-10 flex flex-col items-center gap-3 text-sm text-muted sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:justify-start">
            <li v-for="point in heroPoints" :key="point" class="flex items-center gap-2">
              <svg class="size-4 shrink-0 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {{ $t(`home.hero.points.${point}`) }}
            </li>
          </ul>
        </div>
        <UnsplashPhoto
          photo="hero"
          priority
          sizes="(min-width: 1152px) 544px, (min-width: 1024px) 45vw, 100vw"
          class="aspect-[4/3] rounded-3xl shadow-xl ring-1 ring-line"
        />
      </div>
    </section>

    <!-- Categories -->
    <section class="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="categories-title">
      <div class="max-w-2xl">
        <h2 id="categories-title" class="text-3xl font-bold tracking-tight text-balance">{{ $t('home.categories.title') }}</h2>
        <p class="mt-3 text-pretty text-muted">{{ $t('home.categories.subtitle') }}</p>
      </div>
      <!-- Two compact columns on phones (no descriptions) so the list stays short. -->
      <ul class="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <li
          v-for="category in CATEGORIES"
          :key="category.key"
          class="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line sm:p-6"
        >
          <span class="flex size-10 items-center justify-center rounded-lg bg-well">
            <!-- eslint-disable-next-line vue/no-v-html -- static icon markup defined above -->
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="category.icon" />
          </span>
          <h3 class="mt-3 text-sm font-semibold sm:mt-4 sm:text-base">{{ $t(`home.categories.items.${category.key}.title`) }}</h3>
          <p class="mt-1 hidden text-sm text-muted sm:block">{{ $t(`home.categories.items.${category.key}.text`) }}</p>
        </li>
      </ul>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="scroll-mt-16 border-y border-line bg-surface" aria-labelledby="how-title">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div class="max-w-2xl">
          <h2 id="how-title" class="text-3xl font-bold tracking-tight text-balance">{{ $t('home.how.title') }}</h2>
          <p class="mt-3 text-pretty text-muted">{{ $t('home.how.subtitle') }}</p>
        </div>
        <ol class="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          <li v-for="(step, i) in steps" :key="step">
            <span class="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
              {{ i + 1 }}
            </span>
            <h3 class="mt-5 text-lg font-semibold">{{ $t(`home.how.steps.${step}.title`) }}</h3>
            <p class="mt-2 text-pretty text-muted">{{ $t(`home.how.steps.${step}.text`) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- For clients / for specialists -->
    <section class="mx-auto grid max-w-6xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
      <div
        v-for="(audience, i) in audiences"
        :key="audience.key"
        class="flex flex-col overflow-hidden rounded-3xl"
        :class="i === 0 ? 'bg-surface shadow-sm ring-1 ring-line' : 'bg-primary text-on-primary'"
      >
        <UnsplashPhoto :photo="audience.key" sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw" class="aspect-[16/9]" />
        <div class="flex flex-1 flex-col p-8 sm:p-10">
          <h2 class="text-2xl font-bold tracking-tight">{{ $t(`home.audience.${audience.key}.title`) }}</h2>
          <p class="mt-2" :class="i === 0 ? 'text-muted' : 'opacity-80'">{{ $t(`home.audience.${audience.key}.text`) }}</p>
          <ul class="mt-6 flex-1 space-y-3">
            <li v-for="point in audience.points" :key="point" class="flex gap-3">
              <svg class="mt-0.5 size-5 shrink-0" :class="i === 0 ? 'text-success' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {{ $t(`home.audience.${audience.key}.points.${point}`) }}
            </li>
          </ul>
          <NuxtLink
            v-if="audience.to"
            :to="audience.to"
            class="mt-8 self-start"
            :class="i === 0
              ? primaryButton
              : 'inline-flex items-center justify-center rounded-lg bg-on-primary px-5 py-3 text-sm font-medium text-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary'"
          >
            {{ audience.cta }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Final call to action -->
    <section class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div class="rounded-3xl bg-well px-6 py-16 text-center sm:px-12">
        <h2 class="text-3xl font-bold tracking-tight text-balance">{{ $t('home.final.title') }}</h2>
        <p class="mx-auto mt-3 max-w-xl text-pretty text-muted">{{ $t('home.final.text') }}</p>
        <NuxtLink :to="startLink.to" class="mt-8" :class="primaryButton">{{ startLink.label }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-grid {
  background-image:
    linear-gradient(to right, var(--app-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--app-line) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%);
}
</style>
