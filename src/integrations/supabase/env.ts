type SupabaseEnv = {
  url: string | undefined;
  publishableKey: string | undefined;
  expectedProjectId: string;
  resolvedProjectId: string | null;
  isMisconfigured: boolean;
  misconfigurationReason: string | null;
};

const DEFAULT_EXPECTED_PROJECT_ID = 'oeqicekxrhuwqgnahmeq';

const parseSupabaseProjectIdFromUrl = (url: string): string | null => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // <project-ref>.supabase.co
    const firstLabel = hostname.split('.')[0];
    return firstLabel || null;
  } catch {
    return null;
  }
};

export const supabaseEnv: SupabaseEnv = (() => {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

  // We intentionally keep a safe default here so deployments can't silently point
  // back to the old Lovable/Enaitoti project if Netlify env vars are wrong.
  const expectedProjectId =
    (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined)?.trim() || DEFAULT_EXPECTED_PROJECT_ID;

  const resolvedProjectId = url ? parseSupabaseProjectIdFromUrl(url) : null;

  let isMisconfigured = false;
  let misconfigurationReason: string | null = null;

  if (!url) {
    isMisconfigured = true;
    misconfigurationReason = 'Missing VITE_SUPABASE_URL';
  } else if (!publishableKey) {
    isMisconfigured = true;
    misconfigurationReason = 'Missing VITE_SUPABASE_PUBLISHABLE_KEY';
  } else if (!resolvedProjectId) {
    isMisconfigured = true;
    misconfigurationReason = 'Invalid VITE_SUPABASE_URL (unable to parse project id)';
  } else if (resolvedProjectId !== expectedProjectId) {
    isMisconfigured = true;
    misconfigurationReason = `Supabase project mismatch: expected ${expectedProjectId} but got ${resolvedProjectId}`;
  }

  return {
    url,
    publishableKey,
    expectedProjectId,
    resolvedProjectId,
    isMisconfigured,
    misconfigurationReason,
  };
})();
