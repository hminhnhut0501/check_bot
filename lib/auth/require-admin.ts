import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserFromBearerToken } from '@/lib/supabase/auth';

export async function requireReviewer(request: Request) {
  const user = await getUserFromBearerToken(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabase = createServerSupabaseClient();
  const { data: role } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', user.id)
    .in('roles.name', ['reviewer', 'senior_reviewer', 'admin', 'super_admin'])
    .limit(1)
    .maybeSingle();

  if (!role) {
    return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, response: null };
}

export async function requirePermission(request: Request, permission: string) {
  const user = await getUserFromBearerToken(request);
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const supabase = createServerSupabaseClient();
  const { data: roles } = await supabase.from('user_roles').select('roles!inner(name, permissions)').eq('user_id', user.id);
  const allowed = (roles ?? []).some((entry) => {
    const role = entry.roles as unknown as { name: string; permissions: Record<string, boolean> };
    return role.permissions?.[permission] === true || role.permissions?.['*'] === true;
  });
  if (!allowed) return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, response: null };
}
