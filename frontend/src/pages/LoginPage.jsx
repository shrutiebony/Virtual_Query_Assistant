import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, ArrowRight, Database, Sparkles, ShieldCheck } from 'lucide-react';
import './AuthPages.css';

const FEATURES = [
  { icon: Database,    text: 'PostgreSQL & MongoDB support' },
  { icon: Sparkles,    text: 'Natural language → SQL via Gemini AI' },
  { icon: ShieldCheck, text: 'Encrypted, secure connections' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Please fill in all fields.');
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(Array.isArray(d) ? d.map(x => x.msg || JSON.stringify(x)).join(', ')
        : typeof d === 'string' ? d : 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* ── Left brand panel ── */}
      <div className="auth-left">
        <div className="auth-grid-bg" />
        <div className="auth-orb" />

        <div className="auth-brand">
          <div className="auth-brand-icon"><Zap size={18} /></div>
          <span>DB Assistant</span>
        </div>

        <div className="auth-left-body">
          <div className="auth-tagline">Query your databases with plain English</div>
          <p className="auth-sub">No SQL expertise needed. Connect, ask, and get answers instantly - powered by Google Gemini AI.</p>

          <div className="auth-feature-list">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="auth-feature-row">
                <div className="auth-feature-icon"><Icon size={14} /></div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-left-footer">
          <span className="auth-pill">PostgreSQL</span>
          <span className="auth-pill">MongoDB</span>
          <span className="auth-pill">Gemini 2.0</span>
          <span className="auth-pill">CSV / Excel</span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-eyebrow">Welcome back</div>
          <h2 className="auth-card-title">Sign in to your account</h2>
          <p className="auth-card-sub">Enter your credentials to continue</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={submit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" value={form.email}
                onChange={handle} placeholder="you@example.com" autoComplete="email" autoFocus />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={form.password}
                onChange={handle} placeholder="••••••••" autoComplete="current-password" />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <><span>Sign in</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}