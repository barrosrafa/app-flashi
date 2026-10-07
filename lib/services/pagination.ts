export type PageCursor = { time: string; id: string };
export type PageOptions = { cursor?: PageCursor | null; query?: string; limit?: number };
export function pageLimit(value = 100) { return Math.min(100, Math.max(1, Math.trunc(value))); }
export function pageResult<T extends { id: string }>(rows: T[], limit: number, timeKey: keyof T) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, hasMore, nextCursor: hasMore && last ? { time: String(last[timeKey]), id: last.id } : null };
}
