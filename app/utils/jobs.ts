import type { User } from 'firebase/auth'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

export const MAX_JOB_TITLE_LENGTH = 100
export const MAX_JOB_DESCRIPTION_LENGTH = 5000
export const JOB_CURRENCIES = ['PLN', 'EUR', 'USD'] as const

export type JobCurrency = typeof JOB_CURRENCIES[number]

export interface NewJob {
  title: string
  category: CategoryKey
  description: string
  /** Whole amount in `currency`, or null when the client didn't give a budget. */
  budget: { amount: number, currency: JobCurrency } | null
}

/**
 * Saves a job the user posted to users/{uid}/jobs (readable and writable only by them,
 * see firestore.rules). Returns the new document's id.
 */
export async function postJob(user: User, job: NewJob) {
  const ref = await addDoc(collection(useFirestore(), 'users', user.uid, 'jobs'), {
    ...job,
    status: 'open',
    createdAt: serverTimestamp()
  })
  return ref.id
}
