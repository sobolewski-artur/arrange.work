<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const localePath = useLocalePath()
const user = useCurrentUser()
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 text-slate-900">
    <h1 class="text-4xl font-bold tracking-tight">{{ $t('welcome') }}</h1>

    <!-- Auth state only exists in the browser; render nothing until it resolves. -->
    <div class="flex h-9 items-center gap-3 text-sm">
      <template v-if="user">
        <img
          v-if="user.photoURL"
          :src="user.photoURL"
          alt=""
          referrerpolicy="no-referrer"
          class="size-8 rounded-full"
        >
        <span>{{ $t('auth.signedInAs', { name: user.displayName || user.email }) }}</span>
        <NuxtLink :to="localePath('/account')" class="rounded-md bg-white px-3 py-1 ring-1 ring-slate-200 hover:bg-slate-100">
          {{ $t('account.title') }}
        </NuxtLink>
        <button
          type="button"
          class="rounded-md bg-white px-3 py-1 ring-1 ring-slate-200 hover:bg-slate-100"
          @click="signOutUser"
        >
          {{ $t('auth.signOut') }}
        </button>
      </template>
      <template v-else-if="user === null">
        <NuxtLink :to="localePath('/login')" class="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700">
          {{ $t('auth.signIn') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath({ path: '/login', query: { mode: 'signup' } })"
          class="rounded-md bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-100"
        >
          {{ $t('auth.signUp') }}
        </NuxtLink>
      </template>
    </div>

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
