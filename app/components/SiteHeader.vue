<script setup lang="ts">
const localePath = useLocalePath()
const user = useCurrentUser()

const initial = computed(() => (user.value?.displayName || user.value?.email || '?').trim().charAt(0).toUpperCase())

const navLink = 'rounded-md px-3 py-2 text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg'
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-line bg-page/80 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <NuxtLink :to="localePath('/')" class="shrink-0 text-base font-bold tracking-tight">
        arrange.work
      </NuxtLink>

      <nav :aria-label="$t('nav.label')" class="hidden items-center text-sm md:flex">
        <NuxtLink :to="localePath({ path: '/', hash: '#how-it-works' })" :class="navLink">
          {{ $t('nav.howItWorks') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/about')" :class="navLink" active-class="!text-fg">
          {{ $t('nav.about') }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <!-- On phones the theme switch lives in the footer, leaving room for sign-in. -->
        <LanguageSwitcher />
        <div class="hidden sm:block">
          <ThemeToggle />
        </div>

        <!-- Auth state only exists in the browser; keep the space reserved until it resolves. -->
        <NuxtLink
          v-if="user"
          :to="localePath('/account')"
          :title="$t('nav.account')"
          class="ml-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <span class="sr-only">{{ $t('nav.account') }}</span>
          <img
            v-if="user.photoURL"
            :src="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            class="size-9 rounded-full object-cover ring-1 ring-line"
          >
          <span
            v-else
            aria-hidden="true"
            class="flex size-9 items-center justify-center rounded-full bg-well text-sm font-semibold text-muted ring-1 ring-line"
          >
            {{ initial }}
          </span>
        </NuxtLink>
        <template v-else-if="user === null">
          <NuxtLink
            :to="localePath('/login')"
            class="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {{ $t('auth.signIn') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath({ path: '/login', query: { mode: 'signup' } })"
            class="hidden rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg sm:inline-block"
          >
            {{ $t('auth.signUp') }}
          </NuxtLink>
        </template>
        <span v-else class="block h-9 w-16" aria-hidden="true" />
      </div>
    </div>
  </header>
</template>
