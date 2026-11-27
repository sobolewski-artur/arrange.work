// Applies server/db/migrations/*.sql that haven't run yet on the database in DATABASE_URL_UNPOOLED
// (or DATABASE_URL), in file-name order, each in its own transaction.
//
//   pnpm db:migrate                          # the branch in .env.local (see `neon checkout`)
//   DATABASE_URL_UNPOOLED=… pnpm db:migrate  # any other branch, e.g. production
import { readdir, readFile } from 'node:fs/promises'
import { Pool } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL_UNPOOLED or DATABASE_URL (run `neon checkout <branch>` to write .env.local).')
  process.exit(1)
}

const dir = new URL('../server/db/migrations/', import.meta.url)
const pool = new Pool({ connectionString: url })
const client = await pool.connect()
try {
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const { rows } = await client.query('select name from schema_migrations')
  const applied = new Set(rows.map(r => r.name))
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()
  const host = new URL(url).hostname
  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(new URL(file, dir), 'utf8')
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      await client.query('commit')
    } catch (e) {
      await client.query('rollback')
      throw new Error(`${file} failed: ${e.message}`, { cause: e })
    }
    console.log(`Applied ${file} on ${host}`)
    count++
  }
  console.log(count ? `${count} migration(s) applied.` : `Up to date (${host}).`)
} finally {
  client.release()
  await pool.end()
}
