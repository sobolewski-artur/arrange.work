// Neon services for every branch of the "Arrange" project (https://neon.com/docs/reference/neon-ts.md).
// Apply changes with `neon config plan` (dry run), then `neon deploy`.
import { defineConfig } from '@neon/config/v1'

export default defineConfig({
  // Neon Auth (Managed Better Auth): users and sessions in the branch's `neon_auth` schema. The app
  // reaches it through its own /api/auth proxy (server/api/auth/[...path].ts).
  auth: true,
  buckets: {
    // Profile photos: avatars/{uid}/{timestamp}.{webp|png}. Anyone can read an object by its URL
    // (like the Firebase download URLs they replace); only the server, with the branch
    // credential, can write. See server/utils/storage.ts.
    avatars: { access: 'public_read' }
  }
})
