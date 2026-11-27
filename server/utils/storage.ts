import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * Neon Object Storage (S3-compatible). The client reads AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * AWS_ENDPOINT_URL_S3 and AWS_REGION from the environment: written to .env.local by
 * `neon checkout`, and App Hosting env/secrets in production (see apphosting.yaml).
 * Buckets are declared in neon.ts.
 */
let client: S3Client | undefined
function s3() {
  // Neon requires path-style addressing.
  client ??= new S3Client({ forcePathStyle: true })
  return client
}

/** Profile photos, `{uid}/{timestamp}.{ext}`. A public_read bucket: anyone can read by URL. */
export const AVATARS_BUCKET = 'avatars'

/** Anonymous URL of an object in a public_read bucket. */
export function publicObjectUrl(bucket: string, key: string) {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3
  if (!endpoint) throw new Error('AWS_ENDPOINT_URL_S3 is not set. Run `neon checkout <branch>` to write .env.local.')
  return `${endpoint.replace(/\/+$/, '')}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function putObject(bucket: string, key: string, body: Uint8Array, contentType: string, cacheControl?: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }))
}

/** Deletes every object whose key starts with `prefix`, except `keep`. */
export async function deleteObjectsByPrefix(bucket: string, prefix: string, keep?: string) {
  let token: string | undefined
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    const keys = (page.Contents ?? []).map(o => o.Key!).filter(key => key !== keep)
    if (keys.length) {
      await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } }))
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
}
