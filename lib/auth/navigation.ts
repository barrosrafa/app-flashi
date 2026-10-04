const INTERNAL_ORIGIN = 'https://flashi.invalid';
const AUTH_PATHS = new Set(['/login', '/register']);

export function safeReturnTo(value: string | null | undefined): string {
  const candidate = value?.trim() ?? '';
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) return '/';

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return '/';
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    if (AUTH_PATHS.has(normalizedPath)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function requestedReturnTo(search: string): string {
  return safeReturnTo(new URLSearchParams(search).get('next'));
}

export function loginHref(returnTo: string): string {
  const query = new URLSearchParams({ next: safeReturnTo(returnTo) });
  return `/login?${query.toString()}`;
}

export function isAuthRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === 'AUTH_REQUIRED' || error.name === 'AuthRequiredError' || error.message.includes(': AUTH_REQUIRED');
}

export function redirectToLoginForAuthError(error: unknown, returnTo: string): boolean {
  if (!isAuthRequiredError(error) || typeof window === 'undefined') return false;
  window.location.replace(loginHref(returnTo));
  return true;
}
