'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else router.push('/admin/inbox');
    setLoading(false);
  }

  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <p className="eyebrow">SCAMSHIELD ADMIN</p><h1>Đăng nhập</h1><p className="muted">Dùng tài khoản reviewer đã được cấp quyền.</p>
    <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
  </form></main>;
}
