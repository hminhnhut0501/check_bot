import type { ReactNode } from 'react';
import './globals.css';
import './public.css';
import './components.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
