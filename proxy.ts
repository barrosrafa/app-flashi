import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeReturnTo } from './lib/auth/navigation';

const PRIVATE_PREFIXES = [
  '/decks', '/study', '/exams', '/analytics', '/profile', '/leaderboard',
  '/tools', '/search', '/import', '/export', '/occlusion', '/media',
  '/settings', '/templates', '/socratic',
];
const AUTH_PATHS = new Set(['/login', '/register']);

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey || supabaseKey.includes('replace_me')) {
    throw new Error('MISSING_PUBLIC_SUPABASE_CONFIG');
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && isPrivatePath(pathname)) {
    const returnTo = safeReturnTo(`${pathname}${request.nextUrl.search}`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', returnTo);
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user && AUTH_PATHS.has(pathname.replace(/\/+$/, '') || '/')) {
    const returnTo = safeReturnTo(request.nextUrl.searchParams.get('next'));
    return copyCookies(response, NextResponse.redirect(new URL(returnTo, request.url)));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
