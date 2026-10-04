'use client';

import { useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';
import { identifyUser, resetAnalytics, setUser } from '../lib/observability';

export function ObservabilityBridge() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let mounted = true;
    const identify = (userId: string) => { identifyUser(userId, { app: 'flashi', locale: navigator.language }); setUser(userId); };
    void supabase.auth.getUser().then(({ data }) => { if (mounted && data.user) identify(data.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) identify(session.user.id);
      if (event === 'SIGNED_OUT') { resetAnalytics(); setUser(null); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  return null;
}
