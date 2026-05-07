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

function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 25, label: 'Weak', color: '#ef4444' };
  if (s === 2) return { score: 60, label: 'Medium', color: '#f59e0b' };
  return { score: 100, label: 'Strong', color: '#10b981' };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Please fill all fields.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true); setError('');
    try {
      await register(form.email, form.password);
      navigate('/login', { state: { success: 'Account created! Please sign in.' } });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = pwStrength(form.password);

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
          <div className="auth-tagline">Start querying smarter today</div>
          <p className="auth-sub">Connect your databases and get instant AI-powered insights with no SQL expertise needed.</p>
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
          <div className="auth-card-eyebrow">Get started free</div>
          <h2 className="auth-card-title">Create an account</h2>
          <p className="auth-card-sub">Join and start querying your databases with AI</p>

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
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={16} /></span>
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handle}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.password && (
                <div className="auth-strength">
                  <div className="auth-strength-bar">
                    <div
                      className="auth-strength-fill"
                      style={{ width: `${strength.score}%`, background: strength.color }}
                    />
                  </div>
                  <span className="auth-strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="auth-field">
              <div className="auth-field-row">
                <label htmlFor="confirm">Confirm password</label>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={16} /></span>
                <input
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={handle}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
                <button type="button" className="auth-input-action" onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading
                ? <span className="auth-spinner" />
                : <><span>Create account</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
