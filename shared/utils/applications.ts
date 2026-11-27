// Application fields and rules, used by the app and the API. Auto-imported in both.
import type { Job } from './jobs'

export const MAX_APPLICATION_MESSAGE_LENGTH = 2000
/** Longest applicant name stored on an application. */
export const MAX_APPLICANT_NAME_LENGTH = 100
/** The job owner sees at most this many applications (oldest first). */
export const MAX_LISTED_APPLICATIONS = 100
/** Largest page of "My applications" the API returns. */
export const MAX_APPLICATION_PAGE_SIZE = 50

/**
 * A specialist's application to a job; each user can apply once per job. The applicant's name
 * and email are shared with the job's owner; only the applicant and the owner can read it.
 */
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly unknown[]).includes(value)
}

export interface Application {
  applicant: string
  name: string
  email: string
  message: string
  /** Set by the job's owner; new applications are 'pending'. */
  status: ApplicationStatus
  createdAt: Date | null
  /** When the owner accepted or rejected it; null while pending. */
  decidedAt: Date | null
}

/** An application together with the job it's for (null if the job is gone or not visible). */
export interface MyApplication {
  jobId: string
  application: Application
  job: Job | null
}
