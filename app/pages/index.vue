<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 text-slate-900">
    <h1 class="text-4xl font-bold tracking-tight">{{ $t('welcome') }}</h1>

    <nav class="flex items-center gap-3 text-sm">
      <span class="text-slate-500">{{ $t('language') }}:</span>
      <NuxtLink
        v-for="l in locales"
        :key="l.code"
        :to="switchLocalePath(l.code)"
        class="rounded-md px-3 py-1 transition-colors"
        :class="l.code === locale ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 hover:bg-slate-100'"
      >
        {{ l.name }}
      </NuxtLink>
    </nav>
  </main>
</template>
