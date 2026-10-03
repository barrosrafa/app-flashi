'use client';
import { useEffect, useState } from 'react';
import { edgeErrorBus } from '../services/http/event-bus';
import { RateLimitError } from '../services/http/errors';
export function useEdgeErrorHandler() { const [error, setError] = useState<RateLimitError | null>(null); useEffect(() => edgeErrorBus.subscribe((value) => { if (value instanceof RateLimitError) setError(value); }), []); return { rateLimit: error?.retryAfterSec ?? null, clear: () => setError(null) }; }
