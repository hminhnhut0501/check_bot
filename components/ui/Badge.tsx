import type { ReactNode } from 'react';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}
