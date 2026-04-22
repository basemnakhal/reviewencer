/**
 * OpenAI client for:
 *   - text-embedding-3-small (1536 dims) → powers semantic search
 *   - whisper-1 → video review transcription
 */
import 'server-only';
import OpenAI from 'openai';
import { env } from '@/lib/env';

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/** Return a single embedding vector for a text. */
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: text.slice(0, 8000), // safety cap
  });
  return res.data[0].embedding;
}

/** Embed many texts in one call. Returns vectors in order. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts.map(t => t.slice(0, 8000)),
  });
  return res.data.map(d => d.embedding);
}

/**
 * Transcribe an audio/video file with Whisper.
 * Accepts a File or Blob (e.g. from a Supabase Storage download).
 */
export async function transcribe(file: File): Promise<string> {
  const res = await openai.audio.transcriptions.create({
    model: env.OPENAI_TRANSCRIBE_MODEL,
    file,
  });
  return res.text.trim();
}
