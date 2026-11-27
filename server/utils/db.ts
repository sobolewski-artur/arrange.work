import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let sql: NeonQueryFunction<false, false> | undefined

/**
 * Lakebase Postgres on Neon, over HTTP (one round trip per query, no connection to keep open).
 * Uses the pooled DATABASE_URL: written to .env.local by `neon checkout`, and an App Hosting
 * secret in production (see apphosting.yaml).
 *
 * Use it as a tagged template (`db()`select … where id = ${id}``) or, for SQL built from
 * fixed pieces, `db().query(text, params)`. Never interpolate request values into `text`.
 */
export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set. Run `neon checkout <branch>` to write .env.local.')
    sql = neon(url)
  }
  return sql
}

export type Row = Record<string, any>
