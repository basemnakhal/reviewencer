/**
 * Anthropic Claude client + thin helpers.
 * - `claude`: shared SDK instance
 * - `askClaudeJson`: prompt → validated JSON (with one retry)
 * - `askClaudeText`: prompt → plain text
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { extractJson } from '@/lib/utils';

export const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const CLAUDE_MODEL = env.ANTHROPIC_MODEL;

export interface AskOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/** Plain text completion. */
export async function askClaudeText(opts: AskOptions): Promise<string> {
  const res = await claude.messages.create({
    model:       opts.model       ?? CLAUDE_MODEL,
    max_tokens:  opts.maxTokens   ?? 1024,
    temperature: opts.temperature ?? 0.3,
    system:      opts.system,
    messages:    [{ role: 'user', content: opts.user }],
  });
  const block = res.content[0];
  if (block?.type !== 'text') throw new Error('Claude returned non-text block');
  return block.text;
}

/**
 * JSON completion. Sends a strict "respond only with JSON" reminder,
 * extracts the first valid JSON object, and retries once on parse failure.
 */
export async function askClaudeJson<T = unknown>(opts: AskOptions): Promise<T> {
  const call = async (reminder?: string): Promise<string> => {
    const system = reminder ? `${opts.system}\n\n${reminder}` : opts.system;
    return askClaudeText({ ...opts, system, temperature: opts.temperature ?? 0.2 });
  };

  const first = await call();
  const parsed = extractJson<T>(first);
  if (parsed) return parsed;

  // Retry once with a firmer instruction
  const second = await call(
    'Your previous response was not valid JSON. ' +
    'Respond ONLY with a single JSON object. No prose, no code fences, no commentary.',
  );
  const reparsed = extractJson<T>(second);
  if (reparsed) return reparsed;

  throw new Error('Claude returned invalid JSON after retry');
}
