'use client';
import { useEffect, useRef } from 'react';

// Renders the EXACT proven dashboard (the one you approved). The view markup,
// CSS and Chart.js rendering live as static assets in /public so the look is
// identical to Finanzanalyse_2025.html. We only swap the data source: instead
// of an embedded JSON blob, the page injects `window.__FINANZ_DATA__` from the
// database. See docs/dashboard-reference.html for the original.
export default function DashboardView({ data }: { data: unknown }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).__FINANZ_DATA__ = data;
    let cancelled = false;
    (async () => {
      // 1) inject the skeleton markup (tabs, cards, canvases)
      const html = await fetch('/dashboard-skeleton.html').then((r) => r.text());
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = html;
      // 2) load Chart.js, then the rendering script
      await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
      await loadScript('/dashboard-view.js');
    })();
    return () => { cancelled = true; };
  }, [data]);

  return (
    <>
      <link rel="stylesheet" href="/dashboard.css" />
      <div ref={ref} style={{ maxWidth: 1180, margin: '0 auto', padding: 24 }} />
    </>
  );
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.body.appendChild(s);
  });
}
