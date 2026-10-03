'use client';
import { useCallback, useEffect, useState } from 'react';
import { tagService } from '../lib/services/tag-service';
import type { Tag } from '../lib/types/tag';
export function useTags() { const [tags, setTags] = useState<Tag[]>([]); const [loading, setLoading] = useState(true); const reload = useCallback(async () => { setLoading(true); try { setTags(await tagService.list()); } finally { setLoading(false); } }, []); useEffect(() => { void reload(); }, [reload]); return { tags, loading, reload }; }
