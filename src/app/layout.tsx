import type { ReactNode } from 'react';

export const metadata = { title: 'Finanz-Dashboard', description: 'Persönliche Finanzübersicht' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: '#0f1419', color: '#e6edf3' }}>{children}</body>
    </html>
  );
}
