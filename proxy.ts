import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { shouldRedirectToOnboarding } from './lib/onboarding-gate';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey || supabaseKey.includes('replace_me')) return response;
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedPrefixes = ['/activation', '/dashboard', '/study', '/decks', '/analytics', '/exams', '/profile', '/search', '/import', '/export', '/media', '/settings', '/tools', '/templates', '/occlusion', '/socratic', '/leaderboard'];
  const protectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const publicDemo = pathname === '/study/demo';
  const metadata = data.user?.user_metadata;
  const shouldCheckPersistedActivation = Boolean(
    data.user && protectedRoute && !publicDemo && pathname !== '/onboarding'
      && shouldRedirectToOnboarding(metadata, false, 'UNKNOWN'),
  );
  let hasPersistedPlan = false;
  let activationStatus: string | null = 'UNKNOWN';
  if (data.user && shouldCheckPersistedActivation) {
    const [{ data: plan, error: planError }, { data: activation, error: activationError }] = await Promise.all([
      supabase.from('learning_plans').select('id').eq('user_id', data.user.id).maybeSingle(),
      supabase.from('activation_flows').select('status').eq('user_id', data.user.id).maybeSingle(),
    ]);
    hasPersistedPlan = !planError && Boolean(plan);
    activationStatus = activationError ? 'UNKNOWN' : activation?.status ?? null;
  }
  if (data.user && protectedRoute && !publicDemo && pathname !== '/onboarding'
      && shouldRedirectToOnboarding(metadata, hasPersistedPlan, activationStatus)) {
    const redirect = NextResponse.redirect(new URL('/onboarding', request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
