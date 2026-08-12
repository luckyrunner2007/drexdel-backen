import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'drexdel-media';

/**
 * Lazy, nullable Supabase admin client.
 *
 * The client is only initialised when BOTH `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` are present. When they are absent the module
 * exports `null` instead of throwing — this prevents a hard crash during
 * server startup (which previously killed the entire process before any
 * auth endpoint could serve a request). Callers must guard against `null`.
 */
let _supabaseAdmin: SupabaseClient | null = null;

export const supabaseAdmin: SupabaseClient | null = (() => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — media upload endpoints will return 503 until env is set.');
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
})();

export const getSupabaseBucket = (): string => SUPABASE_BUCKET;

export const buildStoragePath = (userId: string, postId: string, filename: string): string => {
  const ext = filename.split('.').pop() || 'bin';
  return userId + '/' + postId + '.' + ext;
};

export const isImageMime = (mime: string): boolean => mime.startsWith('image/');
export const isVideoMime = (mime: string): boolean => mime.startsWith('video/');
