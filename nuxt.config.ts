// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Firebase web app config. Not secret (shipped to every browser) — access is enforced by
      // Firestore security rules. Each key can be overridden with NUXT_PUBLIC_FIREBASE_<KEY>.
      firebase: {
        apiKey: 'AIzaSyA1p0kZOvy-e9dIs5h7hdWNV-7wdoV2oGc',
        authDomain: 'arrange-work.firebaseapp.com',
        databaseURL: 'https://arrange-work-default-rtdb.europe-west1.firebasedatabase.app',
        projectId: 'arrange-work',
        storageBucket: 'arrange-work.firebasestorage.app',
        messagingSenderId: '28840533097',
        appId: '1:28840533097:web:90488016783a18373556f8',
        measurementId: 'G-DVS8L07VZL'
      }
    }
  },

  vite: {
    plugins: [tailwindcss()]
  },

  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  }
})
