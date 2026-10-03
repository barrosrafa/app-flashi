'use client';
import { useEffect, useRef, useState } from 'react';
import { optimizerService, type OptimizationStatus } from '../lib/services/optimizer-service';
export function useFsrsOptimization(pollMs = 60000) { const [status, setStatus] = useState<OptimizationStatus | null>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null); useEffect(() => { let cancelled = false; const tick = async () => { try { const value = await optimizerService.statusSummary(); if (!cancelled) setStatus(value); } catch { /* the page retains the last known status */ } }; void tick(); timer.current = setInterval(() => void tick(), pollMs); return () => { cancelled = true; if (timer.current) clearInterval(timer.current); }; }, [pollMs]); return status; }
