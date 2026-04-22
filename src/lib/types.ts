/**
 * Shared TypeScript types — mirror the Supabase schema in supabase/schema.sql.
 * Keep in sync when you change the DB.
 */

// ----- Enums -----
export type ModerationStatus =
  | 'pending'
  | 'auto_approved'
  | 'flagged'
  | 'rejected'
  | 'published';

export type RiskCategory =
  | 'defamation'
  | 'insult'
  | 'commercial_disparage'
  | 'religion_politics'
  | 'private_info'
  | 'hate_speech'
  | 'spam_fake'
  | 'low_risk';

export type TranscriptSource = 'typed' | 'video_transcription';

export type ActorType = 'ai' | 'moderator' | 'admin' | 'system';

export type UserRole = 'user' | 'moderator' | 'admin';

// ----- Rows -----
export interface Profile {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  label: string;
  emoji: string | null;
  tint: string | null;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  tagline: string | null;
  logo_emoji: string | null;
  brand_color: string | null;
  verified: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  business_id: string;
  author_id: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  video_url: string | null;
  transcript_source: TranscriptSource;
  tags: string[];
  moderation_status: ModerationStatus;
  moderation_rationale: string | null;
  risk_categories: RiskCategory[];
  embedding: number[] | null;
  created_at: string;
  published_at: string | null;
}

export interface ModerationEvent {
  id: string;
  review_id: string;
  actor_id: string | null;
  actor_type: ActorType;
  from_status: ModerationStatus | null;
  to_status: ModerationStatus;
  rationale: string | null;
  risk_categories: RiskCategory[];
  model: string | null;
  created_at: string;
}

export interface ThemeScore {
  label: string;
  score: number;
}

export interface AiSummary {
  business_id: string;
  headline: string;
  pros: string[];
  cons: string[];
  themes: ThemeScore[];
  sentiment: number | null;
  review_count: number;
  avg_rating: number | null;
  generated_by: string | null;
  generated_at: string;
  stale: boolean;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  cited_reviews: string[];
  created_at: string;
}

// ----- Derived (views / RPC results) -----
export interface BusinessCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_emoji: string | null;
  brand_color: string | null;
  verified: boolean;
  category_id: string;
  ai_headline: string;
  sentiment: number;
  review_count: number;
  avg_rating: number;
  themes: ThemeScore[];
}

export interface MatchedReview {
  id: string;
  business_id: string;
  business_name: string;
  category_id: string;
  text: string;
  rating: number;
  tags: string[];
  similarity: number;
}

// ----- Moderation verdict (Claude) -----
export interface ModerationVerdict {
  status: Exclude<ModerationStatus, 'pending' | 'published'>;
  risk_categories: RiskCategory[];
  rationale: string;
  suggested_edit: string | null;
}

// ----- RAG chat answer shape -----
export interface ComparisonCard {
  rank: number;
  business_id: string;
  business_slug: string;
  business_name: string;
  headline: string;
  summary: string;
  rating: number;
  review_count: number;
  pull_quote: string | null;
  cited_review_ids: string[];
}

export interface ChatAnswer {
  prose: string;
  comparison: ComparisonCard[];
  follow_ups: string[];
  cited_review_ids: string[];
}
