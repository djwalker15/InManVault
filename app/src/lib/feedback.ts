// Client helpers for the in-app feedback widget. Mirrors the shape of
// `account.ts`: thin wrappers over the Supabase client that the
// FeedbackSheet calls. The ClickUp side is handled server-side by the
// `submit-feedback` edge function — the token never reaches the browser.

import type { SupabaseClient } from '@supabase/supabase-js'
import { downscaleToBlob } from '@/lib/downscale'

export type FeedbackType = 'bug' | 'idea' | 'question'

export interface FeedbackContext {
  route: string
  user_agent: string
  viewport: { w: number; h: number }
  app_version: string
}

export interface SubmitFeedbackPayload {
  feedback_type: FeedbackType
  message: string
  contact_ok: boolean
  context: FeedbackContext
  crew_id: string | null
  /** All screenshots, in pick order. */
  screenshot_paths: string[]
  /**
   * Legacy single-screenshot field — always mirrored to
   * `screenshot_paths[0] ?? null` so an older edge function deployed
   * mid-release still records the first screenshot.
   */
  screenshot_path: string | null
}

export interface SubmitFeedbackResult {
  feedback_id: string
  clickup_task_url: string | null
  clickup_synced: boolean
}

const SCREENSHOT_BUCKET = 'feedback-screenshots'

/**
 * Snapshot of where/how the feedback was given. Attached silently so the
 * client doesn't have to describe their environment.
 */
export function gatherContext(): FeedbackContext {
  return {
    route: window.location.pathname,
    user_agent: window.navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    app_version:
      (import.meta.env.VITE_APP_VERSION as string | undefined) ??
      import.meta.env.MODE,
  }
}

/**
 * Downscales (1500 px longest edge, JPEG) and uploads a screenshot to
 * the private feedback bucket, keyed under the submitter's Clerk user id
 * (`<userId>/<uuid>.jpg`) to satisfy the storage RLS prefix check.
 * Returns the object path to persist on the feedback row.
 */
export async function uploadFeedbackScreenshot(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const blob = await downscaleToBlob(file)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/**
 * Invokes the submit-feedback edge function. The session token is
 * forwarded automatically by the Supabase client.
 */
export async function submitFeedback(
  supabase: SupabaseClient,
  payload: SubmitFeedbackPayload,
): Promise<SubmitFeedbackResult> {
  const { data, error } = await supabase.functions.invoke<SubmitFeedbackResult>(
    'submit-feedback',
    { body: payload },
  )
  if (error) throw error
  if (!data) throw new Error('submit-feedback returned no body')
  return data
}
