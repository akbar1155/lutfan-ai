import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function PageLoader({ label }: { label: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="gen-loader" aria-hidden />
      <p className="hint">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  actionTo,
  actionLabel,
  children,
}: {
  title: string;
  body?: string;
  actionTo?: string;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {body ? <p className="empty-state-body">{body}</p> : null}
      {actionTo && actionLabel ? (
        <Link className="cta" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {children}
    </div>
  );
}
