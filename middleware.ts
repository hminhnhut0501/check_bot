import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isMaintenanceModeEnabled } from '@/lib/maintenance';

export async function middleware(request: NextRequest) {
  if (isMaintenanceModeEnabled()) {
    const pathname = request.nextUrl.pathname;
    const isAllowedPath =
      pathname === '/maintenance' ||
      pathname === '/api/health' ||
      pathname.startsWith('/api/internal/group-bot') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/_next/') ||
      pathname === '/favicon.ico';

    if (!isAllowedPath) {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  const response = await updateSession(request);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
