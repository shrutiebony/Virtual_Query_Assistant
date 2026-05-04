import React from 'react';
import './ui.css';

/* Button */
export function Button({ children, variant = 'primary', size = 'md', loading, icon, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="btn-spinner" />}
      {icon && !loading && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

/* Input */
export function Input({ label, error, hint, icon, className = '', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <div className="field-wrap">
        {icon && <span className="field-icon">{icon}</span>}
        <input className={`field-input ${icon ? 'has-icon' : ''} ${error ? 'has-error' : ''}`} {...props} />
      </div>
      {error && <span className="field-error">{error}</span>}
      {hint && !error && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* Textarea */
export function Textarea({ label, error, hint, className = '', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <textarea className={`field-input field-textarea ${error ? 'has-error' : ''}`} {...props} />
      {error && <span className="field-error">{error}</span>}
      {hint && !error && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* Select */
export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <select className={`field-input field-select ${error ? 'has-error' : ''}`} {...props}>
        {children}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/* Card */
export function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div className={`card ${padding ? 'card-padded' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

/* Badge */
export function Badge({ children, color = 'gray', size = 'sm' }) {
  return <span className={`badge badge-${color} badge-${size}`}>{children}</span>;
}

/* Spinner */
export function Spinner({ size = 24 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

/* Alert - safe against FastAPI error objects */
function toSafeString(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(v => v?.msg || v?.message || String(v)).join(', ');
  if (typeof val === 'object') return val.msg || val.message || val.detail || JSON.stringify(val);
  return String(val);
}

export function Alert({ children, type = 'info', onClose }) {
  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-content">{toSafeString(children)}</span>
      {onClose && <button className="alert-close" onClick={onClose}>x</button>}
    </div>
  );
}

/* Tabs */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`tab-btn ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <span className="tab-icon">{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* StatCard */
export function StatCard({ label, value, icon, color = 'blue', delta }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      <div className="stat-value">{value}</div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  );
}

/* PageHeader */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

/* EmptyState */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}