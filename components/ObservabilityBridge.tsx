'use client';
import { bindLocalUserNamespace,unbindLocalUserNamespace } from '../lib/db/local-user-scope';
import { track } from '../lib/observability/posthog';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';
import { capture, identifyUser, normalizeErrorCode, resetAnalytics, setUser, captureException } from '../lib/observability';

function safeTarget(element: Element): string {
  const candidate = element.closest('button, a, [role="button"], input[type="submit"]');
  if (!candidate) return 'unknown';
  const labelled = candidate.getAttribute('data-telemetry') || candidate.getAttribute('name') || candidate.id || candidate.tagName;
  return labelled.replace(/\s+/g, ' ').trim().slice(0, 80) || candidate.tagName;
}

export function ObservabilityBridge() {
  const pathname = usePathname();

  useEffect(() => {
    track('app_loaded',{route:pathname||'/'});
    capture('page_viewed', { route: pathname || '/' });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('button, a, [role="button"], input[type="submit"]')) capture('ui_interaction', { interaction: 'click', target: safeTarget(target), route: window.location.pathname });
    };
    const onSubmit = (event: SubmitEvent) => capture('ui_interaction', { interaction: 'submit', target: safeTarget(event.target as Element), route: window.location.pathname });
    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || 'Unhandled client error');
      captureException(error, { tags: { area: 'global-client-error' }, extra: { route: window.location.pathname } });
      capture('client_error', { error_code: normalizeErrorCode(error), source: 'error', route: window.location.pathname });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection'));
      captureException(error, { tags: { area: 'unhandled-rejection' }, extra: { route: window.location.pathname } });
      capture('client_error', { error_code: normalizeErrorCode(error), source: 'unhandledrejection', route: window.location.pathname });
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let mounted = true;
    const identify = (userId: string) => { void bindLocalUserNamespace(userId); identifyUser(userId, { app: 'flashi', locale: navigator.language }); setUser(userId); };
    void supabase.auth.getUser().then(({ data }) => { if (mounted && data.user) identify(data.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) identify(session.user.id);
      if (event === 'SIGNED_OUT') { resetAnalytics(); setUser(null); void unbindLocalUserNamespace(); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  return null;
}
