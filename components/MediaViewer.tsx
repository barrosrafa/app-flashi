'use client';
/* eslint-disable @next/next/no-img-element -- Private signed media must not be proxied/cached by an image optimizer; occlusion uses exact image geometry. */

export function MediaViewer({ url, mime }: { url: string; mime?: string }) { if (mime?.startsWith('audio/')) return <audio controls src={url} />; if (mime?.startsWith('video/')) return <video controls className="max-w-full" src={url} />; return <img src={url} alt="Mídia do cartão" className="max-w-full" />; }
