import { createClient } from '@supabase/supabase-js';

export async function getUserFromBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}
