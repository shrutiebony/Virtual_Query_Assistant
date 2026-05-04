import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Alert } from '../components/ui';
import { Zap, User, Lock } from 'lucide-react';
import './AuthPages.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.email || !form.password)   return setError('Please fill all fields.');
    if (form.password !== form.confirm)  return setError('Passwords do not match.');
    if (form.password.length < 6)        return setError('Password must be at least 6 characters.');
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

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon"><Zap size={22} /></div>
          <span>DB Assistant</span>
        </div>
        <div className="auth-headline">
          <h1>Start querying<br />smarter today.</h1>
          <p>Connect your databases and get instant AI-powered insights.</p>
        </div>
        <div className="auth-features">
          {['Free to get started', 'Supports PostgreSQL & MongoDB', 'Upload CSV & Excel files', 'Gemini-powered EDA reports'].map(f => (
            <div key={f} className="auth-feature"><span className="auth-feature-dot" />{f}</div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card fade-in">
          <div className="auth-card-header">
            <h2>Create an account</h2>
            <p>Get started for free</p>
          </div>

          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          <form onSubmit={submit} className="auth-form">
            <Input label="Email" name="email" type="email" value={form.email} onChange={handle}
              placeholder="your@email.com" icon={<User size={15} />} autoFocus />
            <Input label="Password" name="password" type="password" value={form.password} onChange={handle}
              placeholder="At least 6 characters" icon={<Lock size={15} />} />
            <Input label="Confirm password" name="confirm" type="password" value={form.confirm} onChange={handle}
              placeholder="Repeat your password" icon={<Lock size={15} />} />
            <Button type="submit" size="lg" loading={loading} style={{ width: '100%', marginTop: 4 }}>
              Create account
            </Button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}