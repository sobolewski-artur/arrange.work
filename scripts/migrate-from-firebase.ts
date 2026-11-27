// One-off copy of the app's data from Firebase (Firestore, Cloud Storage, Auth) to Neon.
//
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json pnpm migrate:firebase [--avatars] [--dry-run]
//
// Reads with firebase-admin, so it needs a service account key for the arrange-work project
// (Firebase console → Project settings → Service accounts → Generate new private key). Keep the
// key out of the repo and delete it afterwards. Writes to the Neon branch in
// DATABASE_URL_UNPOOLED / DATABASE_URL and AWS_* (.env.local, or set them for another branch).
//
// Users now sign in with Neon Auth, so each Firebase uid is replaced with the id of the Neon
// Auth user that has the same email address (neon_auth.user on the target branch). Passwords
// can't be moved: people sign in with Google as before (same email, so it's the same account),
// or sign up again with the same email, or use "Forgot password?". Run this AFTER they have
// signed in once on the target branch; data of Firebase users without a Neon Auth account yet is
// skipped and listed, and a later run picks it up.
//
// Copies:
// - jobs (top-level `jobs`, and old ones still under users/{uid}/jobs), keeping their ids so
//   links keep working, with fields cleaned up the same way the app read them;
// - applications (jobs/{id}/applications/{uid}) whose job and applicant are copied;
// - users/{uid}.notificationsSeenAt;
// - with --avatars: profile photos stored in Firebase Storage (avatars/{uid}/…) go to the Neon
//   `avatars` bucket and become the Neon Auth user's image. Google profile photos and other URLs
//   are left alone.
//
// Safe to run more than once: rows are upserted (Firebase wins), so a last run right before
// switching over picks up anything written in between. Nothing in Firebase is changed. With
// --dry-run nothing is written anywhere.
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth, type UserRecord } from 'firebase-admin/auth'
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { Pool } from '@neondatabase/serverless'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { isCountryCode } from '../shared/utils/countries'
import { cityKey, JOB_CURRENCIES, MAX_JOB_DESCRIPTION_LENGTH, MAX_JOB_TITLE_LENGTH, normalizeCity } from '../shared/utils/jobs'
import { isApplicationStatus, MAX_APPLICANT_NAME_LENGTH, MAX_APPLICATION_MESSAGE_LENGTH } from '../shared/utils/applications'
import { MAX_JOB_TAGS, normalizeTags } from '../shared/utils/tags'

const PROJECT_ID = 'arrange-work'
const FIREBASE_BUCKET = 'arrange-work.firebasestorage.app'
const NEON_AVATARS_BUCKET = 'avatars'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const withAvatars = args.has('--avatars')

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Set DATABASE_URL_UNPOOLED or DATABASE_URL (run `neon checkout <branch>`).')

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: FIREBASE_BUCKET })
const firestore = getFirestore()
const pool = new Pool({ connectionString: databaseUrl })

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

// --- Firebase uid → Neon Auth user id, by email ---

async function listFirebaseUsers() {
  const users: UserRecord[] = []
  let pageToken: string | undefined
  do {
    const page = await getAuth().listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)
  return users
}

async function mapUsers(firebaseUsers: UserRecord[]) {
  const { rows } = await pool.query<{ id: string, email: string }>('select id, email from neon_auth."user"')
  const byEmail = new Map(rows.map(r => [r.email.toLowerCase(), r.id]))
  const ids = new Map<string, string>()
  const missing: string[] = []
  for (const u of firebaseUsers) {
    const id = u.email ? byEmail.get(u.email.toLowerCase()) : undefined
    if (id) ids.set(u.uid, id)
    else missing.push(u.email ?? `(no email, uid ${u.uid})`)
  }
  return { ids, missing }
}

// --- Read and clean up Firestore data ---

interface JobRow {
  id: string, owner: string, title: string, description: string, tags: string[], country: string | null
  city: string | null, cityKey: string | null, budgetAmount: number | null, budgetCurrency: string | null
  createdAt: Date, updatedAt: Date | null
}

/** Same reading rules as the app had for Firestore jobs. `owner` is the Firebase uid here. */
function jobRow(id: string, owner: string, data: DocumentData): JobRow | null {
  const title = String(data.title ?? '').trim().slice(0, MAX_JOB_TITLE_LENGTH)
  if (!owner || !title) return null
  // Jobs had a list of `locations` (older ones a single `location`: { mode, city }); keep the
  // first city, if any.
  const city = normalizeCity(Array.isArray(data.locations) ? data.locations.find(c => normalizeCity(c)) : data.location?.city)
  const amount = typeof data.budget?.amount === 'number' ? Math.round(data.budget.amount) : 0
  const budgetOk = amount > 0 && (JOB_CURRENCIES as readonly unknown[]).includes(data.budget?.currency)
  return {
    id,
    owner,
    title,
    description: String(data.description ?? '').slice(0, MAX_JOB_DESCRIPTION_LENGTH),
    tags: normalizeTags(data.tags, MAX_JOB_TAGS),
    country: isCountryCode(data.country) ? data.country : null,
    city,
    cityKey: city === null ? null : cityKey(city),
    budgetAmount: budgetOk ? amount : null,
    budgetCurrency: budgetOk ? data.budget.currency : null,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt)
  }
}

async function readJobs() {
  const jobs = new Map<string, JobRow>()
  let skipped = 0
  // Old location first, so a job present in both places takes the top-level copy.
  const legacy = await firestore.collectionGroup('jobs').get()
  for (const doc of legacy.docs) {
    const parent = doc.ref.parent.parent
    if (parent?.parent.id !== 'users') continue
    const row = jobRow(doc.id, parent.id, doc.data())
    if (row) jobs.set(doc.id, row)
    else skipped++
  }
  const top = await firestore.collection('jobs').get()
  for (const doc of top.docs) {
    const row = jobRow(doc.id, doc.get('owner'), doc.data())
    if (row) jobs.set(doc.id, row)
    else skipped++
  }
  return { jobs: [...jobs.values()], legacy: legacy.size - top.size, skipped }
}

interface ApplicationRow {
  jobId: string, applicant: string, name: string, email: string, message: string
  status: string, createdAt: Date, decidedAt: Date | null
}

/** `applicant` is the Firebase uid here. */
async function readApplications(jobIds: Set<string>) {
  const snapshot = await firestore.collectionGroup('applications').get()
  const rows: ApplicationRow[] = []
  let skipped = 0
  for (const doc of snapshot.docs) {
    const jobId = doc.ref.parent.parent?.id
    const data = doc.data()
    const message = String(data.message ?? '').trim().slice(0, MAX_APPLICATION_MESSAGE_LENGTH)
    if (!jobId || !jobIds.has(jobId) || !message) {
      skipped++
      continue
    }
    const status = isApplicationStatus(data.status) ? data.status : 'pending'
    const createdAt = toDate(data.createdAt) ?? new Date()
    rows.push({
      jobId,
      applicant: doc.id,
      name: String(data.name ?? '').slice(0, MAX_APPLICANT_NAME_LENGTH),
      email: String(data.email ?? ''),
      message,
      status,
      createdAt,
      // The table requires a decision time exactly when the status isn't pending.
      decidedAt: status === 'pending' ? null : toDate(data.decidedAt) ?? createdAt
    })
  }
  return { rows, skipped }
}

async function readSeenTimes() {
  const snapshot = await firestore.collection('users').get()
  return snapshot.docs
    .map(doc => ({ uid: doc.id, seenAt: toDate(doc.get('notificationsSeenAt')) }))
    .filter(u => u.seenAt)
}

// --- Write to Neon ---

async function writeRows(jobs: JobRow[], applications: ApplicationRow[], users: { uid: string, seenAt: Date | null }[]) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const j of jobs) {
      await client.query(
        `insert into jobs (id, owner, title, description, tags, country, city, city_key, budget_amount, budget_currency, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (id) do update set owner = excluded.owner, title = excluded.title, description = excluded.description,
           tags = excluded.tags, country = excluded.country, city = excluded.city, city_key = excluded.city_key,
           budget_amount = excluded.budget_amount, budget_currency = excluded.budget_currency,
           created_at = excluded.created_at, updated_at = excluded.updated_at`,
        [j.id, j.owner, j.title, j.description, j.tags, j.country, j.city, j.cityKey, j.budgetAmount, j.budgetCurrency, j.createdAt, j.updatedAt]
      )
    }
    for (const a of applications) {
      await client.query(
        `insert into applications (job_id, applicant, name, email, message, status, created_at, decided_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (job_id, applicant) do update set name = excluded.name, email = excluded.email, message = excluded.message,
           status = excluded.status, created_at = excluded.created_at, decided_at = excluded.decided_at`,
        [a.jobId, a.applicant, a.name, a.email, a.message, a.status, a.createdAt, a.decidedAt]
      )
    }
    for (const u of users) {
      await client.query(
        `insert into users (uid, notifications_seen_at) values ($1, $2)
         on conflict (uid) do update set notifications_seen_at = excluded.notifications_seen_at`,
        [u.uid, u.seenAt]
      )
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// --- Avatars ---

/** The Firebase Storage object path in a download URL for our bucket, if it's one of our avatars. */
function firebaseAvatarPath(photoURL: string | undefined) {
  if (!photoURL) return null
  try {
    const url = new URL(photoURL)
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (!match || match[1] !== FIREBASE_BUCKET) return null
    const path = decodeURIComponent(match[2]!)
    return path.startsWith('avatars/') ? path : null
  } catch {
    return null
  }
}

async function copyAvatars(firebaseUsers: UserRecord[], ids: Map<string, string>) {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3
  if (!endpoint) throw new Error('AWS_ENDPOINT_URL_S3 is not set (run `neon checkout <branch>`).')
  const s3 = new S3Client({ forcePathStyle: true })
  const bucket = getStorage().bucket()
  let copied = 0, missing = 0
  for (const user of firebaseUsers) {
    const path = firebaseAvatarPath(user.photoURL)
    const neonId = ids.get(user.uid)
    if (!path || !neonId) continue
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) {
      missing++
      continue
    }
    const [[bytes], [meta]] = await Promise.all([file.download(), file.getMetadata()])
    // Same key scheme as the app: {user id}/{timestamp}.{ext}
    const key = `${neonId}/${path.split('/').pop()}`
    const url = `${endpoint.replace(/\/+$/, '')}/${NEON_AVATARS_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`
    if (!dryRun) {
      await s3.send(new PutObjectCommand({
        Bucket: NEON_AVATARS_BUCKET, Key: key, Body: bytes,
        ContentType: meta.contentType ?? 'image/webp', CacheControl: 'public, max-age=31536000, immutable'
      }))
      await pool.query('update neon_auth."user" set image = $1, "updatedAt" = now() where id = $2', [url, neonId])
    }
    copied++
  }
  return { copied, missing }
}

// --- Run ---

try {
  const firebaseUsers = await listFirebaseUsers()
  const { ids, missing } = await mapUsers(firebaseUsers)
  const neonId = (uid: string) => ids.get(uid)

  const { jobs: allJobs, legacy, skipped: skippedJobs } = await readJobs()
  const jobs = allJobs.filter(j => neonId(j.owner)).map(j => ({ ...j, owner: neonId(j.owner)! }))
  const { rows: allApplications, skipped: skippedApplications } = await readApplications(new Set(jobs.map(j => j.id)))
  const applications = allApplications.filter(a => neonId(a.applicant)).map(a => ({ ...a, applicant: neonId(a.applicant)! }))
  const users = (await readSeenTimes()).filter(u => neonId(u.uid)).map(u => ({ ...u, uid: neonId(u.uid)! }))

  console.log(`Firebase Auth: ${firebaseUsers.length} users, ${ids.size} with a Neon Auth account (matched by email).`)
  if (missing.length) {
    console.log(`  Not in Neon Auth yet (their data is skipped; re-run after they sign in): ${missing.join(', ')}`)
  }
  console.log(`Firestore: ${jobs.length} of ${allJobs.length} jobs (${Math.max(0, legacy)} still under users/{uid}/jobs, ${skippedJobs} unusable), `
    + `${applications.length} of ${allApplications.length} applications (${skippedApplications} with a missing job or empty message), ${users.length} notification states.`)

  if (!dryRun) {
    await writeRows(jobs, applications, users)
    console.log(`Written to Neon (${new URL(databaseUrl).hostname}).`)
  }
  if (withAvatars) {
    const { copied, missing: missingFiles } = await copyAvatars(firebaseUsers, ids)
    console.log(`Avatars: ${copied} ${dryRun ? 'to copy' : 'copied and set as profile images'}${missingFiles ? `, ${missingFiles} missing in Firebase Storage` : ''}.`)
  }
  if (dryRun) console.log('Dry run: nothing was written.')
} finally {
  await pool.end()
}
