import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { statusSlug } from '../lib/format';

export function PageHeader({ title, description, actions, back }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && <Link className="back-link" to={back.to}><Icon name="back" size={16} />{back.label}</Link>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Alert({ tone = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={16} />
      <span>{children}</span>
      {onClose && <button type="button" className="icon-button" onClick={onClose} aria-label="Dismiss"><Icon name="close" size={14} /></button>}
    </div>
  );
}

export function Feedback({ error, message, onClear }) {
  return (
    <>
      <Alert tone="error">{error}</Alert>
      <Alert tone="success" onClose={onClear}>{message}</Alert>
    </>
  );
}

export function StatusBadge({ status, label }) {
  return <span className={`badge badge-${statusSlug(status)}`}>{label || status}</span>;
}

export function StatCard({ label, value, hint, tone = 'neutral' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <small className="stat-hint">{hint}</small>}
    </article>
  );
}

export function Panel({ title, actions, children, className = '', padded = true }) {
  return (
    <section className={`panel ${padded ? '' : 'panel-flush'} ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title = 'Nothing to show yet', description, action }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading-block" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

/**
 * Table on wide screens; each row becomes a labelled card on phones (see .data-table in app.css).
 * Column options: key, header, render(row), align ('right'), primary (card title), actions, hideOnMobile.
 */
export function DataTable({ columns, rows, rowKey = 'id', empty, onRowClick, loading, caption }) {
  if (loading && !rows?.length) return <Loading label="Loading records…" />;
  if (!rows?.length) return empty || <EmptyState title="No records found" description="Try a different search or filter." />;
  return (
    <div className={`table-wrap${loading ? ' is-refreshing' : ''}`}>
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>{columns.map((column) => <th key={column.key} className={column.align === 'right' ? 'align-right' : ''} scope="col">{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey] ?? index}
              className={onRowClick ? 'is-clickable' : ''}
              onClick={onRowClick ? (event) => { if (!event.target.closest('button, a, input, select')) onRowClick(row); } : undefined}
              onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick(row); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={[
                    column.align === 'right' ? 'align-right' : '',
                    column.primary ? 'cell-primary' : '',
                    column.actions ? 'cell-actions' : '',
                    column.hideOnMobile ? 'hide-mobile' : ''
                  ].join(' ').trim() || undefined}
                >
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, setPage }) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>{start}–{end} of {total}</span>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="left" size={16} /></button>
        <span className="page-indicator">Page {page} of {pageCount}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><Icon name="right" size={16} /></button>
      </div>
    </nav>
  );
}

export function Drawer({ open, title, description, onClose, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-drawer');
    const focusTarget = panelRef.current?.querySelector('input:not([type=hidden]), select, textarea, button:not(.drawer-close)') || panelRef.current;
    focusTarget?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-drawer');
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <section className={`drawer drawer-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <header className="drawer-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-button drawer-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label }) {
  return (
    <div className="search-input">
      <Icon name="search" size={16} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label || placeholder} />
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
        return (
          <button type="button" key={optionValue} className={value === optionValue ? 'is-active' : ''} aria-pressed={value === optionValue} onClick={() => onChange(optionValue)}>
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="page">
      <EmptyState title="Access denied" description="Your account does not have permission to view this page." action={<Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link>} />
    </div>
  );
}
