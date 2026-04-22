/**
 * Barrel file for src/lib — re-export the small bits that are safe to
 * import anywhere. Server-only modules (claude, moderation, summaries, etc.)
 * are intentionally NOT re-exported here to prevent accidental client bundle
 * pollution. Import those directly from their paths on the server.
 */
export * from './types';
export * from './utils';
export * from './brand';
export * from './categories';
