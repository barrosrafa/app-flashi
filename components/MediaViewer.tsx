'use client';
export function MediaViewer({ url, mime }: { url: string; mime?: string }) { if (mime?.startsWith('audio/')) return <audio controls src={url} />; if (mime?.startsWith('video/')) return <video controls className="max-w-full" src={url} />; return <img src={url} alt="Mídia do cartão" className="max-w-full" />; }
