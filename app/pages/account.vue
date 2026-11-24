<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('account.title') })
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-slate-900">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <NuxtLink :to="localePath('/')" class="text-sm text-slate-500 hover:text-slate-900">
        ← {{ $t('account.back') }}
      </NuxtLink>

      <div class="mt-6 flex items-center gap-4">
        <img
          v-if="user.photoURL"
          :src="user.photoURL"
          alt=""
          referrerpolicy="no-referrer"
          class="size-14 rounded-full"
        >
        <div class="min-w-0">
          <h1 class="truncate text-xl font-bold tracking-tight">{{ user.displayName || user.email }}</h1>
          <p class="truncate text-sm text-slate-500">{{ user.email }}</p>
        </div>
      </div>

      <button
        type="button"
        class="mt-8 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        @click="signOutUser"
      >
        {{ $t('auth.signOut') }}
      </button>
    </div>
  </main>
</template>
