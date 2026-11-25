<script setup lang="ts">
const localePath = useLocalePath()
const route = useRoute()
const { t } = useI18n()
const user = useCurrentUser()

const initial = computed(() => (user.value?.displayName || user.value?.email || '?').trim().charAt(0).toUpperCase())

const links = computed(() => [
  { to: localePath({ path: '/', hash: '#how-it-works' }), label: t('nav.howItWorks') },
  { to: localePath('/about'), label: t('nav.about') },
  ...(user.value
    ? [
        { to: localePath('/find-work'), label: t('nav.findWork') },
        { to: localePath('/jobs'), label: t('nav.myJobs') },
        { to: localePath('/jobs/new'), label: t('home.cta.postJob') }
      ]
    : [])
])

// --- Mobile menu (below lg, where the links don't fit beside the switches) ---

const header = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)

function closeMenu({ focusButton = false } = {}) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (focusButton) menuButton.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu({ focusButton: true })
}

function onPointerDown(event: PointerEvent) {
  if (header.value && !header.value.contains(event.target as Node)) closeMenu()
}

// Listen only while the menu is open.
watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerDown)
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerDown)
  }
})
onBeforeUnmount(() => closeMenu())

// Any navigation (including the "How it works" anchor) closes it.
watch(() => route.fullPath, () => closeMenu())

async function signOutFromMenu() {
  closeMenu()
  await signOutUser()
}

const navLink = 'rounded-md px-3 py-2 text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg'
const menuLink = 'block rounded-lg px-3 py-2.5 text-base font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-fg'
</script>

<template>
  <header ref="header" class="sticky top-0 z-20 border-b border-line bg-page/80 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <NuxtLink :to="localePath('/')" class="shrink-0 text-base font-bold tracking-tight">
        arrange.work
      </NuxtLink>

      <nav :aria-label="$t('nav.label')" class="hidden items-center text-sm lg:flex">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to" :class="navLink" exact-active-class="!text-fg">
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <!-- Below lg, both switches live in the menu. -->
        <div class="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
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

        <button
          ref="menuButton"
          type="button"
          class="-mr-1 flex size-10 items-center justify-center rounded-lg text-fg transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg lg:hidden"
          :aria-expanded="menuOpen"
          aria-controls="site-menu"
          :aria-label="menuOpen ? $t('nav.closeMenu') : $t('nav.openMenu')"
          @click="menuOpen = !menuOpen"
        >
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path v-if="menuOpen" d="M18 6 6 18M6 6l12 12" />
            <path v-else d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-show="menuOpen"
        id="site-menu"
        class="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-page shadow-lg lg:hidden"
      >
        <div class="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <nav :aria-label="$t('nav.menu')">
            <ul>
              <li v-for="link in links" :key="link.to">
                <NuxtLink :to="link.to" :class="menuLink">{{ link.label }}</NuxtLink>
              </li>
              <li v-if="user">
                <NuxtLink :to="localePath('/account')" :class="menuLink">{{ $t('nav.account') }}</NuxtLink>
              </li>
            </ul>
          </nav>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 pt-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <div v-if="user === null" class="mt-4 grid grid-cols-2 gap-2 pb-2">
            <NuxtLink
              :to="localePath('/login')"
              class="rounded-lg bg-surface px-4 py-2.5 text-center text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover"
            >
              {{ $t('auth.signIn') }}
            </NuxtLink>
            <NuxtLink
              :to="localePath({ path: '/login', query: { mode: 'signup' } })"
              class="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-on-primary transition hover:bg-primary-hover"
            >
              {{ $t('auth.signUp') }}
            </NuxtLink>
          </div>
          <button
            v-else-if="user"
            type="button"
            class="mt-4 mb-2 w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover"
            @click="signOutFromMenu"
          >
            {{ $t('auth.signOut') }}
          </button>
        </div>
      </div>
    </Transition>
  </header>
</template>
