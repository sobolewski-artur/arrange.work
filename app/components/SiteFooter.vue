<script setup lang="ts">
const localePath = useLocalePath()
const year = new Date().getFullYear()

const link = 'text-muted transition-colors hover:text-fg'
</script>

<template>
  <footer class="border-t border-line">
    <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
      <div class="max-w-xs">
        <NuxtLink :to="localePath('/')" class="text-base font-bold tracking-tight">arrange.work</NuxtLink>
        <p class="mt-2 text-sm text-muted">{{ $t('footer.tagline') }}</p>
      </div>

      <nav :aria-label="$t('footer.label')" class="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <NuxtLink :to="localePath('/')" :class="link">{{ $t('nav.home') }}</NuxtLink>
        <NuxtLink :to="localePath({ path: '/', hash: '#how-it-works' })" :class="link">{{ $t('nav.howItWorks') }}</NuxtLink>
        <NuxtLink :to="localePath('/about')" :class="link">{{ $t('nav.about') }}</NuxtLink>
        <NuxtLink :to="localePath({ path: '/login', query: { mode: 'signup' } })" :class="link">{{ $t('home.cta.join') }}</NuxtLink>
      </nav>

      <div class="flex items-center gap-2 self-start">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
    <div class="border-t border-line">
      <p class="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">
        © {{ year }} arrange.work
      </p>
    </div>
  </footer>
</template>
