'use client';
import { useEffect } from 'react';
import { startSyncWorker } from '../lib/db/sync-worker';
export function SyncWorkerRegister() { useEffect(() => startSyncWorker(), []); return null; }
