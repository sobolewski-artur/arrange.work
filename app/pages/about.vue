<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useSeoMeta({
  title: () => `${t('about.meta.title')} – arrange.work`,
  description: () => t('about.meta.description'),
  ogTitle: () => `${t('about.meta.title')} – arrange.work`,
  ogDescription: () => t('about.meta.description')
})

const startLink = computed(() => user.value
  ? { to: localePath('/account'), label: t('home.cta.account') }
  : { to: localePath({ path: '/login', query: { mode: 'signup' } }), label: t('home.cta.start') })

const values = ['clarity', 'trust', 'fairness', 'simplicity'] as const

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-on-primary shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-3 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div>
    <!-- Intro -->
    <section class="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
      <p class="text-sm font-medium text-muted">{{ $t('about.hero.eyebrow') }}</p>
      <h1 class="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        {{ $t('about.hero.title') }}
      </h1>
      <p class="mt-6 max-w-2xl text-lg text-pretty text-muted">{{ $t('about.hero.text') }}</p>
      <UnsplashPhoto
        photo="team"
        priority
        sizes="(min-width: 1152px) 1104px, 100vw"
        class="mt-12 aspect-[4/3] rounded-3xl shadow-xl ring-1 ring-line sm:aspect-[21/9]"
      />
    </section>

    <!-- Mission -->
    <section class="border-y border-line bg-surface" aria-labelledby="mission-title">
      <div class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <UnsplashPhoto
          photo="collaboration"
          sizes="(min-width: 1152px) 544px, (min-width: 1024px) 45vw, 100vw"
          class="aspect-[4/3] rounded-3xl ring-1 ring-line"
        />
        <div>
          <h2 id="mission-title" class="text-3xl font-bold tracking-tight text-balance">{{ $t('about.mission.title') }}</h2>
          <div class="mt-6 space-y-4 text-lg text-pretty text-muted">
            <p>{{ $t('about.mission.p1') }}</p>
            <p>{{ $t('about.mission.p2') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Values -->
    <section class="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="values-title">
      <h2 id="values-title" class="text-3xl font-bold tracking-tight">{{ $t('about.values.title') }}</h2>
      <ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="value in values" :key="value" class="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line">
          <h3 class="font-semibold">{{ $t(`about.values.items.${value}.title`) }}</h3>
          <p class="mt-2 text-sm text-pretty text-muted">{{ $t(`about.values.items.${value}.text`) }}</p>
        </li>
      </ul>
    </section>

    <!-- Early stage + call to action -->
    <section class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div class="grid overflow-hidden rounded-3xl bg-well md:grid-cols-2">
        <UnsplashPhoto
          photo="hands"
          sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
          class="aspect-[16/9] md:aspect-auto md:min-h-80"
        />
        <div class="px-6 py-12 sm:px-12 sm:py-16">
          <h2 class="text-3xl font-bold tracking-tight text-balance">{{ $t('about.stage.title') }}</h2>
          <p class="mt-3 max-w-2xl text-pretty text-muted">{{ $t('about.stage.text') }}</p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <NuxtLink :to="startLink.to" :class="primaryButton">{{ startLink.label }}</NuxtLink>
            <NuxtLink v-if="!user" :to="localePath({ path: '/login', query: { mode: 'signup' } })" :class="secondaryButton">
              {{ $t('home.cta.join') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
