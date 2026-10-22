import type { ReactNode } from 'react';
import type { ApiError } from '../../ui/circles/errors';
import s from './circles.module.css';

export function StateMessage({
  title,
  children,
  error,
  actions,
}: {
  title: string;
  children?: ReactNode;
  error?: ApiError | null;
  actions?: ReactNode;
}) {
  return (
    <div className={`${s.stateBox} ${error ? s.stateError : ''}`} role={error ? 'alert' : 'status'}>
      <h2 className={s.stateTitle}>{title}</h2>
      {children ? <p className={s.stateText}>{children}</p> : null}
      {actions ? <div className={s.btnRow}>{actions}</div> : null}
      {error?.requestId ? <p className={s.reqId}>Reference: {error.requestId}</p> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p className={s.stateText} role="status" aria-live="polite">
      {label}
    </p>
  );
}

/** Makes it obvious when the page is not talking to the real server. */
export function DataBadge({ mode, dataMode }: { mode: 'mock' | 'live'; dataMode?: 'sample' | 'live' }) {
  if (mode === 'mock') return <span className={s.badge}>Mock data · not connected to the server</span>;
  if (dataMode === 'sample') return <span className={s.badge}>Sample data · fictional people</span>;
  return null;
}
