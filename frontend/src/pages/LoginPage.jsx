import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';
import './AuthPages.css';

const FEATURES = [
  { title: 'Natural Language to SQL', desc: 'Ask questions in plain English, get instant results' },
  { title: 'Multi-Agent AI', desc: 'ReAct loops, Swarm agents, and self-correction' },
  { title: '82% Benchmark Accuracy', desc: 'KDD Cup 2026 DataAgent-Bench results' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      {/* LEFT */}
      <div className="auth-left">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />

        <div className="auth-brand">
          <div className="auth-logo-box">DB</div>
          <span className="auth-brand-name">DB Assistant</span>
        </div>

        <div className="auth-left-body">
          <div className="auth-tagline">Query your databases with plain English</div>
          <p className="auth-sub">No SQL expertise needed. Connect any database and get AI-powered answers instantly.</p>
          <div className="auth-feature-list">
            {FEATURES.map(f => (
              <div key={f.title} className="auth-feature-row">
                <div className="auth-feature-icon-box"><Zap size={15} /></div>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-left-footer">SJSU CMPE 295B · Master's Project 2026</div>
      </div>

      {/* RIGHT */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-eyebrow">Welcome back</div>
          <h2 className="auth-card-title">Sign in to your account</h2>
          <p className="auth-card-sub">Enter your credentials to continue</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={submit} className="auth-form">
            <div className="auth-field">
              <div className="auth-field-row">
                <label htmlFor="email">Email address</label>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={16} /></span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field-row">
                <label htmlFor="password">Password</label>
                <a href="#" className="auth-forgot" onClick={e => e.preventDefault()}>Forgot password?</a>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={16} /></span>
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading
                ? <span className="auth-spinner" />
                : <><span>Sign in</span><ArrowRight size={16} /></>
              }
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
