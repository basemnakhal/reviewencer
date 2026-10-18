// process-review: transcribes an uploaded review video (Whisper) and turns the
// transcript into bilingual likes / nopes (Claude). Runs server-side so the
// OpenAI and Anthropic keys never ship in the app bundle.
//
// Body: { videoPath: string, businessName: string }
//   videoPath is the object path inside the `reviews` bucket, e.g.
//   "videos/<user id>_<timestamp>.mp4" — it must belong to the caller.
//
// Secrets: OPENAI_API_KEY, ANTHROPIC_API_KEY
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.104.0"
import Anthropic from "npm:@anthropic-ai/sdk@0.130.0"

const MAX_BYTES = 25 * 1024 * 1024 // Whisper upload limit

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") })

async function transcribe(video: Blob): Promise<string> {
  const form = new FormData()
  form.append("file", video, "review.mp4")
  form.append("model", "whisper-1")
  form.append("response_format", "text")

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Transcription failed: ${await res.text()}`)
  return (await res.text()).trim()
}

async function summarize(transcript: string, businessName: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `You are analyzing a video review of "${businessName}" in the UAE. The reviewer may speak in Arabic, English, or both mixed together.

Transcript:
"${transcript}"

Do the following:
1. Normalize the transcript into clean English (transcript_en) and Arabic (transcript_ar)
2. Extract key positive points in English (ai_likes_en) and Arabic (ai_likes_ar)
3. Extract key negative points in English (ai_nopes_en) and Arabic (ai_nopes_ar)

Respond ONLY with a JSON object in this exact format, no other text:
{
  "transcript_en": "...",
  "transcript_ar": "...",
  "ai_likes_en": ["point 1", "point 2"],
  "ai_likes_ar": ["نقطة 1", "نقطة 2"],
  "ai_nopes_en": ["point 1", "point 2"],
  "ai_nopes_ar": ["نقطة 1", "نقطة 2"]
}

Rules:
- Maximum 4 points per category
- Keep each point short (under 10 words)
- If no negatives found, return empty array for nopes
- If no positives found, return empty array for likes
- If transcript is too short or unclear, return empty arrays and translate what you can`,
    }],
  })

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}"
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
  return {
    transcript_en: parsed.transcript_en ?? transcript,
    transcript_ar: parsed.transcript_ar ?? "",
    ai_likes_en: parsed.ai_likes_en ?? [],
    ai_likes_ar: parsed.ai_likes_ar ?? [],
    ai_nopes_en: parsed.ai_nopes_en ?? [],
    ai_nopes_ar: parsed.ai_nopes_ar ?? [],
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  // verify_jwt already rejected requests without a valid JWT; this resolves who it is.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return json({ error: "Unauthorized" }, 401)

  const { videoPath, businessName } = await req.json().catch(() => ({}))
  if (typeof videoPath !== "string" || typeof businessName !== "string") {
    return json({ error: 'Expected { videoPath, businessName }' }, 400)
  }
  // Uploads are named "videos/<user id>_<timestamp>.mp4" by the app.
  if (!videoPath.startsWith(`videos/${userId}_`)) return json({ error: "Forbidden" }, 403)

  try {
    const { data: video, error: downloadError } = await supabase.storage.from("reviews").download(videoPath)
    if (downloadError || !video) return json({ error: "Video not found" }, 404)
    if (video.size > MAX_BYTES) return json({ error: "Video too large (max 25 MB)" }, 413)

    const transcript = await transcribe(video)
    return json(await summarize(transcript, businessName))
  } catch (e) {
    console.error("process-review failed:", e)
    return json({ error: e instanceof Error ? e.message : "Processing failed" }, 500)
  }
})
