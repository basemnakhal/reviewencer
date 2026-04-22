/**
 * Validated environment variable accessors.
 * Fails loudly at boot if a required var is missing on the server.
 * Public (NEXT_PUBLIC_*) vars are safe on the client.
 */

type EnvRecord = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  OPENAI_API_KEY: string;
  OPENAI_EMBEDDING_MODEL: string;
  OPENAI_TRANSCRIBE_MODEL: string;
  SUPABASE_VIDEO_BUCKET: string;
  NEXT_PUBLIC_APP_URL: string;
  MODERATION_NOTIFY_EMAIL: string;
  MODERATION_STRICT_MODE: boolean;
};

function req(name: keyof EnvRecord, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function opt(name: keyof EnvRecord, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Public — available in client components
  NEXT_PUBLIC_SUPABASE_URL:      req('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: req('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  NEXT_PUBLIC_APP_URL:           opt('NEXT_PUBLIC_APP_URL', 'https://reviewencer.ai'),

  // Server-only — lazy so browser bundles don't choke
  get SUPABASE_SERVICE_ROLE_KEY() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get ANTHROPIC_API_KEY()         { return req('ANTHROPIC_API_KEY'); },
  get ANTHROPIC_MODEL()           { return opt('ANTHROPIC_MODEL', 'claude-sonnet-4-6'); },
  get OPENAI_API_KEY()            { return req('OPENAI_API_KEY'); },
  get OPENAI_EMBEDDING_MODEL()    { return opt('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'); },
  get OPENAI_TRANSCRIBE_MODEL()   { return opt('OPENAI_TRANSCRIBE_MODEL', 'whisper-1'); },
  get SUPABASE_VIDEO_BUCKET()     { return opt('SUPABASE_VIDEO_BUCKET', 'reviews'); },
  get MODERATION_NOTIFY_EMAIL()   { return opt('MODERATION_NOTIFY_EMAIL', 'legal@reviewencer.ai'); },
  get MODERATION_STRICT_MODE()    { return process.env.MODERATION_STRICT_MODE === 'true'; },
};
