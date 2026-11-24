<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const localePath = useLocalePath()
const user = useCurrentUser()
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-6 bg-page text-fg">
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
        <NuxtLink :to="localePath('/account')" class="rounded-md bg-surface px-3 py-1 ring-1 ring-line hover:bg-hover">
          {{ $t('account.title') }}
        </NuxtLink>
        <button
          type="button"
          class="rounded-md bg-surface px-3 py-1 ring-1 ring-line hover:bg-hover"
          @click="signOutUser"
        >
          {{ $t('auth.signOut') }}
        </button>
      </template>
      <template v-else-if="user === null">
        <NuxtLink :to="localePath('/login')" class="rounded-md bg-primary px-3 py-1.5 text-on-primary hover:bg-primary-hover">
          {{ $t('auth.signIn') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath({ path: '/login', query: { mode: 'signup' } })"
          class="rounded-md bg-surface px-3 py-1.5 ring-1 ring-line hover:bg-hover"
        >
          {{ $t('auth.signUp') }}
        </NuxtLink>
      </template>
    </div>

    <nav class="flex items-center gap-3 text-sm">
      <span class="text-muted">{{ $t('language') }}:</span>
      <NuxtLink
        v-for="l in locales"
        :key="l.code"
        :to="switchLocalePath(l.code)"
        class="rounded-md px-3 py-1 transition-colors"
        :class="l.code === locale ? 'bg-primary text-on-primary' : 'bg-surface ring-1 ring-line hover:bg-hover'"
      >
        {{ l.name }}
      </NuxtLink>
    </nav>
  </main>
</template>
