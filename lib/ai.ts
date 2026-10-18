const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY

export async function transcribeVideo(videoUri: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error('OpenAI key not configured')

  const formData = new FormData()
  formData.append('file', {
    uri: videoUri,
    type: 'video/mp4',
    name: 'review.mp4',
  } as any)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Transcription failed: ${error}`)
  }

  return (await response.text()).trim()
}

export async function processReview(videoUri: string, businessName: string): Promise<{
  transcript_en: string
  transcript_ar: string
  ai_likes_en: string[]
  ai_likes_ar: string[]
  ai_nopes_en: string[]
  ai_nopes_ar: string[]
}> {
  const transcript = await transcribeVideo(videoUri)

  if (!ANTHROPIC_KEY) throw new Error('Anthropic key not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
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
- If transcript is too short or unclear, return empty arrays and translate what you can`
      }]
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Summary failed: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  const text = data.content[0].text
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  return {
    transcript_en: parsed.transcript_en ?? transcript,
    transcript_ar: parsed.transcript_ar ?? '',
    ai_likes_en: parsed.ai_likes_en ?? [],
    ai_likes_ar: parsed.ai_likes_ar ?? [],
    ai_nopes_en: parsed.ai_nopes_en ?? [],
    ai_nopes_ar: parsed.ai_nopes_ar ?? [],
  }
}

export async function summarizeReview(transcript: string, businessName: string): Promise<{ likes: string[], nopes: string[] }> {
  if (!ANTHROPIC_KEY) throw new Error('Anthropic key not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are analyzing a video review of "${businessName}" in the UAE. The reviewer may speak in Arabic, English, or both mixed together.

Extract the key points from this transcript and categorize them as either positive (likes) or negative (nopes).

Transcript:
"${transcript}"

Respond ONLY with a JSON object in this exact format, no other text:
{
  "likes": ["point 1", "point 2"],
  "nopes": ["point 1", "point 2"]
}

Rules:
- Maximum 4 points per category
- Keep each point short (under 10 words)
- Translate everything to English
- If no negatives found, return empty array for nopes
- If no positives found, return empty array for likes
- If transcript is too short or unclear, return empty arrays`
      }]
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Summary failed: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  const text = data.content[0].text
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  return { likes: parsed.likes ?? [], nopes: parsed.nopes ?? [] }
}
