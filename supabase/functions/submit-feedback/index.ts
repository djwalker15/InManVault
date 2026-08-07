// submit-feedback
//
// In-app feedback intake. Called by the "Send feedback" sheet in the
// signed-in app. Persists the submission to the `feedback` table and
// auto-files it as a task in the ClickUp InMan → Inbox list so it drops
// straight into the existing issue-intake triage workflow.
//
// Sequence:
//   1. Validate the user's Clerk JWT (the user-context Supabase client
//      forwards Authorization: Bearer <jwt>; RLS + the table default pin
//      submitted_by to auth.jwt()->>'sub').
//   2. Insert the feedback row (user-context client → RLS enforced).
//   3. File a ClickUp task (token lives only here, never in the browser).
//   4. Patch the row with clickup_task_id / clickup_task_url, or record
//      clickup_sync_error if ClickUp failed — either way the submission
//      is kept and we return 200 so the user never loses their feedback.
//
// Deploy with `verify_jwt: false` — same rationale as delete-account:
// Clerk-signed JWTs do not validate against Supabase's native gateway
// secret, so we accept at the gateway and let PostgREST (which trusts
// Clerk) verify the token when the user-context client runs the insert.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase-admin.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const clickupToken = Deno.env.get('CLICKUP_API_TOKEN')
// Defaults to InMan → 📥 Inbox. Overridable per environment.
const clickupListId =
  Deno.env.get('CLICKUP_FEEDBACK_LIST_ID') ?? '901714372658'

const SCREENSHOT_BUCKET = 'feedback-screenshots'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

type FeedbackType = 'bug' | 'idea' | 'question'

interface FeedbackContext {
  route?: string
  user_agent?: string
  viewport?: { w: number; h: number }
  app_version?: string
}

interface RequestBody {
  feedback_type?: FeedbackType
  message?: string
  contact_ok?: boolean
  context?: FeedbackContext | null
  crew_id?: string | null
  /** Preferred: all screenshot paths, in pick order (capped server-side). */
  screenshot_paths?: string[] | null
  /** Legacy single-screenshot field — used when screenshot_paths is absent. */
  screenshot_path?: string | null
}

const MAX_SCREENSHOTS = 5

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: 'Bug',
  idea: 'Idea',
  question: 'Question',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { error: 'Missing or malformed Authorization header' },
      401,
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const feedbackType = body.feedback_type
  const message = body.message?.trim()
  if (
    !feedbackType ||
    !(feedbackType in TYPE_LABEL) ||
    !message ||
    message.length > 4000
  ) {
    return jsonResponse(
      { error: 'feedback_type and a 1–4000 char message are required' },
      400,
    )
  }

  // Resolve screenshots: prefer the multi-image field, fall back to the
  // legacy singular one (older clients mid-deploy). Capped defensively.
  const screenshotPaths = (
    body.screenshot_paths ??
    (body.screenshot_path ? [body.screenshot_path] : [])
  ).slice(0, MAX_SCREENSHOTS)

  // User-context client — forwards the Clerk JWT so RLS + the
  // submitted_by default identify the caller.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: row, error: insertError } = await supabase
    .from('feedback')
    .insert({
      crew_id: body.crew_id ?? null,
      feedback_type: feedbackType,
      message,
      contact_ok: body.contact_ok ?? false,
      context: body.context ?? null,
      // Legacy column stays populated with the first screenshot so
      // existing readers keep working (deprecated; child table is
      // canonical).
      screenshot_path: screenshotPaths[0] ?? null,
    })
    .select('feedback_id, submitted_by')
    .single()

  if (insertError || !row) {
    return jsonResponse(
      { error: insertError?.message ?? 'Failed to record feedback' },
      500,
    )
  }

  const feedbackId = row.feedback_id as string
  const submittedBy = row.submitted_by as string

  // Only paths under the submitter's own prefix are recorded and signed —
  // anything else would let a caller mint URLs for objects they don't own.
  const ownedPaths = screenshotPaths.filter((p) =>
    p.startsWith(`${submittedBy}/`),
  )

  // Child rows (canonical multi-image record). Non-fatal on error: the
  // feedback row is already in, and the legacy column carries the first
  // screenshot regardless.
  if (ownedPaths.length > 0) {
    const { error: screenshotsError } = await supabase
      .from('feedback_screenshots')
      .insert(ownedPaths.map((path) => ({ feedback_id: feedbackId, path })))
    if (screenshotsError) {
      console.error('feedback_screenshots insert failed', screenshotsError)
    }
  }

  // File the ClickUp task. The admin client is used for the signed URLs
  // (the bucket is private) and to patch the row afterwards.
  const admin = createAdminClient()

  const screenshotUrls: string[] = []
  for (const path of ownedPaths) {
    const { data: signed } = await admin.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (signed?.signedUrl) screenshotUrls.push(signed.signedUrl)
  }

  let clickupTaskId: string | null = null
  let clickupTaskUrl: string | null = null
  let clickupSyncError: string | null = null

  if (!clickupToken) {
    clickupSyncError = 'CLICKUP_API_TOKEN not configured'
  } else {
    try {
      const ctx = body.context ?? {}
      const description = [
        message,
        '',
        '---',
        `**Type:** ${TYPE_LABEL[feedbackType]}`,
        `**Submitted by:** ${submittedBy}`,
        body.crew_id ? `**Crew:** ${body.crew_id}` : '**Crew:** (none)',
        ctx.route ? `**Route:** ${ctx.route}` : null,
        ctx.viewport
          ? `**Viewport:** ${ctx.viewport.w}×${ctx.viewport.h}`
          : null,
        ctx.user_agent ? `**Browser:** ${ctx.user_agent}` : null,
        ctx.app_version ? `**App version:** ${ctx.app_version}` : null,
        `**OK to follow up:** ${body.contact_ok ? 'Yes' : 'No'}`,
        ...screenshotUrls.map((url, i) =>
          screenshotUrls.length === 1
            ? `**Screenshot:** ${url}`
            : `**Screenshot ${i + 1}:** ${url}`,
        ),
        '',
        `_InMan feedback ${feedbackId}_`,
      ]
        .filter((l) => l !== null)
        .join('\n')

      const truncated =
        message.length > 80 ? `${message.slice(0, 80)}…` : message
      const res = await fetch(
        `https://api.clickup.com/api/v2/list/${clickupListId}/task`,
        {
          method: 'POST',
          headers: {
            Authorization: clickupToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `[${TYPE_LABEL[feedbackType]}] ${truncated}`,
            markdown_description: description,
          }),
        },
      )

      if (!res.ok) {
        clickupSyncError = `ClickUp responded ${res.status}: ${await res.text()}`
      } else {
        const task = (await res.json()) as { id?: string; url?: string }
        clickupTaskId = task.id ?? null
        clickupTaskUrl = task.url ?? null
      }
    } catch (err) {
      clickupSyncError = err instanceof Error ? err.message : 'ClickUp call failed'
    }
  }

  // Patch the row with the ClickUp outcome (service role — clients have
  // no UPDATE policy). Best-effort: a patch failure doesn't fail the
  // user's submission, which is already persisted.
  await admin
    .from('feedback')
    .update({
      clickup_task_id: clickupTaskId,
      clickup_task_url: clickupTaskUrl,
      clickup_sync_error: clickupSyncError,
    })
    .eq('feedback_id', feedbackId)

  return jsonResponse(
    {
      feedback_id: feedbackId,
      clickup_task_url: clickupTaskUrl,
      clickup_synced: clickupSyncError === null,
    },
    200,
  )
})

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
