/**
 * POST /api/chat
 *
 * Body: { query: string; category?: string; sessionId?: string }
 *
 * Returns the full ChatAnswer JSON (prose + comparison cards + follow-ups).
 * Also logs the interaction to chat_messages (user + assistant) so we can
 * later mine popular questions and improve retrieval.
 *
 * Open endpoint — no auth required. Rate-limited per session/IP.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { answerQuestion } from '@/lib/rag';
import { chatRateLimit } from '@/lib/rate-limit';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { err, json, readJson } from '@/lib/api';

export const runtime = 'nodejs';

interface Body {
  query?:     string;
  category?:  string | null;
  sessionId?: string;
}

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body?.query || typeof body.query !== 'string') return err('Missing "query".');
  const query = body.query.trim().slice(0, 500);
  if (!query) return err('Query must not be empty.');

  const sessionId = body.sessionId || req.headers.get('x-session-id') || randomUUID();
  const limit = chatRateLimit(sessionId);
  if (!limit.ok) return err('Slow down — try again in a minute.', 429, { retryAfter: limit.retryAfter });

  try {
    const answer = await answerQuestion({
      query,
      filterCategory: body.category ?? null,
      matchCount: 16,
    });

    // Log (best-effort; non-blocking on failure)
    const supa = createSupabaseServiceClient();
    void supa.from('chat_messages').insert([
      { session_id: sessionId, role: 'user',      content: query,         cited_reviews: [] },
      { session_id: sessionId, role: 'assistant', content: answer.prose,  cited_reviews: answer.cited_review_ids },
    ]).then(({ error }) => error && console.error('[chat] log failed', error));

    return json({ sessionId, ...answer });
  } catch (e) {
    console.error('[chat] error', e);
    return err('Ask engine failed. Please try again.', 500);
  }
}
