/**
 * Country names in the current language, from the browser's Intl.DisplayNames.
 * `options` is every country sorted by name, for a <select>.
 */
export function useCountries() {
  const { locale } = useI18n()

  const displayNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }))

  function countryName(code: string) {
    try {
      return displayNames.value.of(code) ?? code
    } catch {
      return code
    }
  }

  const collator = computed(() => new Intl.Collator(locale.value))
  const options = computed(() => COUNTRY_CODES
    .map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => collator.value.compare(a.name, b.name)))

  return { countryName, options }
}
