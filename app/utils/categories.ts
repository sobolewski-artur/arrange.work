/**
 * Specialist categories, shown on the home page and picked when posting a job.
 * Names and descriptions are translated under `home.categories.items.<key>`.
 * `icon` is inner SVG markup for a 24×24 stroked icon (static and trusted).
 */
export const CATEGORIES = [
  { key: 'development', icon: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>' },
  { key: 'design', icon: '<path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>' },
  { key: 'marketing', icon: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>' },
  { key: 'writing', icon: '<path d="M4 20h16"/><path d="M4 16 14 6l4 4L8 20H4v-4Z"/>' },
  { key: 'finance', icon: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>' },
  { key: 'legal', icon: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0L5 7ZM19 7l-3 7a3 3 0 0 0 6 0l-3-7Z"/>' },
  { key: 'data', icon: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>' },
  { key: 'consulting', icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' }
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']
