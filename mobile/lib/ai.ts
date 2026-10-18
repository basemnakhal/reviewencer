import { supabase } from './supabase'

export type ProcessedReview = {
  transcript_en: string
  transcript_ar: string
  ai_likes_en: string[]
  ai_likes_ar: string[]
  ai_nopes_en: string[]
  ai_nopes_ar: string[]
}

// Transcription + summarising run in the `process-review` Edge Function so the
// OpenAI / Anthropic keys stay server-side. `videoPath` is the object path of an
// already-uploaded video in the `reviews` bucket.
export type ModerationResult = {
  status: 'published' | 'flagged' | 'rejected'
  rationale: string
  suggested_edit: string | null
}

// Runs the UAE-law moderation check (`moderate-review` Edge Function) on a
// just-inserted pending review, which publishes, flags or rejects it.
export async function moderateReview(reviewId: string): Promise<ModerationResult> {
  const { data, error } = await supabase.functions.invoke<ModerationResult>('moderate-review', {
    body: { reviewId },
  })
  if (error) throw error
  if (!data) throw new Error('Empty response from moderate-review')
  return data
}

export async function processReview(videoPath: string, businessName: string): Promise<ProcessedReview> {
  const { data, error } = await supabase.functions.invoke<ProcessedReview>('process-review', {
    body: { videoPath, businessName },
  })
  if (error) throw error
  if (!data) throw new Error('Empty response from process-review')
  return data
}
