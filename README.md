# arrange.work

Nuxt 4 + `@nuxtjs/i18n` + Tailwind CSS v4. Uses [pnpm](https://pnpm.io).

- **Sign-in:** Neon Auth (Managed Better Auth). Users and sessions live in the branch's
  `neon_auth` schema. The app reaches it through its own `/api/auth` proxy
  (`server/api/auth/[...path].ts`), so the session is a first-party cookie.
- **Data:** Lakebase Postgres on [Neon](https://neon.com) (project "Arrange"). The schema is in
  `server/db/migrations`.
- **Files:** Neon Object Storage, declared in `neon.ts`.
- **API:** Nuxt server routes in `server/api`. Each one reads the caller's session cookie and
  enforces who may read and change what.
- **Hosting:** Firebase App Hosting (`apphosting.yaml`).

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

```bash
pnpm install
npm i -g neon            # Neon CLI, once
neon login               # once
neon link --project-id summer-breeze-45202238
neon checkout dev        # your own Neon branch; writes DATABASE_URL, NEON_AUTH_* and AWS_* into .env.local
pnpm db:migrate          # apply any new migrations to that branch
```

Also add `NEON_AUTH_COOKIE_SECRET` (32+ random characters) to `.env.local` once. Neon's env pull
keeps it:

```bash
node -e "console.log('NEON_AUTH_COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('base64'))" >> .env.local
```

Each developer or feature can have its own branch: `neon checkout <name> --create` copies
production's schema and data into an isolated branch, together with its bucket.

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

This uses the Neon branch in `.env.local`. Every branch has its own users, sessions and files,
so accounts created while developing stay on that branch. Localhost is a trusted origin by
default. Google sign-in uses Neon's shared development credentials until you add your own.

Sign-in emails (verification and password-reset codes) come from Neon's shared sender, which is
rate-limited and meant for development only.

## Database changes

Add a numbered file to `server/db/migrations` (for example `002_add_x.sql`) and run
`pnpm db:migrate` on your branch. `neon diff` shows the schema difference from the parent branch.
Before deploying code that needs it, apply it to production:

```bash
neon checkout production && pnpm db:migrate && neon checkout dev
```

## Production

```bash
pnpm build     # build for production
pnpm preview   # preview the production build locally (uses .env.local)
```

Deploy with `firebase deploy --only apphosting`. The App Hosting secrets listed in
`apphosting.yaml` must exist first.

Before launch, configure Neon Auth on the `production` branch
([checklist](https://neon.com/docs/auth/production-checklist.md)):

- **Google:** your own OAuth client, with redirect URI `<NEON_AUTH_BASE_URL>/callback/google`.
  Add it with `neon neon-auth oauth-provider add --provider-id google --oauth-client-id … --oauth-client-secret … --branch production`.
- **Email:** a custom SMTP provider (`neon neon-auth config email-provider update …`).
- **Origins:** trusted domains for every origin users open (`neon neon-auth domain add https://… --branch production`).
  `https://arrange.work` is already added.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Moving data from Firebase (one-off)

`scripts/migrate-from-firebase.ts` copies jobs, applications and notification state from
Firestore. Each Firebase user id becomes the id of the Neon Auth user with the same email, so
people need to sign in once on Neon first. With `--avatars`, it also copies profile photos from
Firebase Storage and sets them as the Neon profile images. It's safe to re-run. See the header of
the script for details.
