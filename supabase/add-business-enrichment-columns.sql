-- Migration: add enrichment columns to businesses
-- Run this in the Supabase SQL Editor before running enrich-businesses.ts

alter table public.businesses
  add column if not exists address        text,
  add column if not exists area           text,
  add column if not exists city           text,
  add column if not exists phone          text,
  add column if not exists website        text,
  add column if not exists google_maps_url text,
  add column if not exists cover_photo_url text,
  add column if not exists logo_url        text,
  add column if not exists opening_hours  text[],
  add column if not exists google_rating  numeric(3,1),
  add column if not exists google_review_count integer,
  add column if not exists latitude       double precision,
  add column if not exists longitude      double precision;
