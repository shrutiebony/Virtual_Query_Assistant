import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import {
  Database, Leaf, FolderOpen, Link2, ArrowRight,
  Zap, BarChart2, MessageSquare, Sparkles, Shield, Plug,
} from 'lucide-react';
import './DashboardPage.css';

const ACTIONS = [
  {
    label: 'PostgreSQL',
    desc:  'Query your relational database in plain English',
    icon: Database, color: '#2563eb', grad: 'linear-gradient(135deg,#dbeafe,#eff6ff)',
    to: '/query/postgres',
  },
  {
    label: 'MongoDB',
    desc:  'Ask questions across collections with AI',
    icon: Leaf, color: '#059669', grad: 'linear-gradient(135deg,#d1fae5,#f0fdf4)',
    to: '/query/mongo',
  },
  {
    label: 'MySQL',
    desc:  'Natural language queries on MySQL databases',
    icon: Database, color: '#d97706', grad: 'linear-gradient(135deg,#fde68a,#fffbeb)',
    to: '/mysql',
  },
  {
    label: 'Datasets',
    desc:  'Upload CSV / Excel and ask questions instantly',
    icon: FolderOpen, color: '#7c3aed', grad: 'linear-gradient(135deg,#ddd6fe,#f5f3ff)',
    to: '/datasets',
  },
  {
    label: 'Swarm Agents',
    desc:  'Run 4 specialised AI agents in parallel',
    icon: Zap, color: '#4f46e5', grad: 'linear-gradient(135deg,#c7d2fe,#eef2ff)',
    to: '/swarm',
  },
  {
    label: 'Agent Demos',
    desc:  'See L1 Single, L2 ReAct and L3 Swarm in action',
    icon: Sparkles, color: '#0891b2', grad: 'linear-gradient(135deg,#bae6fd,#f0f9ff)',
    to: '/hello-world',
  },
  {
    label: 'Connections',
    desc:  'Add and manage your saved database connections',
    icon: Link2, color: '#be185d', grad: 'linear-gradient(135deg,#fce7f3,#fdf2f8)',
    to: '/connections',
  },
  {
    label: 'Claude Plugin',
    desc:  'Query any database via Claude AI assistant',
    icon: Plug, color: '#92400e', grad: 'linear-gradient(135deg,#fde68a,#fffbeb)',
    to: '/plugin',
  },
  {
    label: 'Benchmark',
    desc:  'View detailed accuracy results by difficulty',
    icon: BarChart2, color: '#047857', grad: 'linear-gradient(135deg,#a7f3d0,#ecfdf5)',
    to: '/benchmark',
  },
];

const HOW = [
  { n: '01', icon: MessageSquare, title: 'Ask in plain English',     desc: 'Type any question — no SQL knowledge required' },
  { n: '02', icon: Sparkles,      title: 'Gemini reads your schema', desc: 'AI understands tables, columns & relationships' },
  { n: '03', icon: Shield,        title: 'Query is verified',        desc: 'Safety-checked before touching your database' },
  { n: '04', icon: BarChart2,     title: 'Results + insights',       desc: 'Tables, charts, and AI-powered EDA instantly' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    authAPI.connections().then(r => setConnections(r.data || [])).catch(() => {});
  }, []);

  const name = user?.displayName || user?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="dash">

      {/* ── Hero ── */}
      <div className="dash-hero-card dash-fade-up">
        <div className="dash-hero-left">
          <div className="dash-greeting">{greeting()}</div>
          <h1 className="dash-hero-title">{name} 👋</h1>
          <p className="dash-hero-sub">
            Your AI-powered database assistant — ask anything, get answers instantly.
          </p>
          <div className="dash-hero-chips">
            <span className="dash-chip dash-chip-blue">PostgreSQL</span>
            <span className="dash-chip dash-chip-green">MongoDB</span>
            <span className="dash-chip dash-chip-amber">MySQL</span>
            <span className="dash-chip dash-chip-purple">Supabase</span>
          </div>
        </div>
        <div className="dash-hero-right">
          <div className="dash-hero-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <button className="dash-quick-btn" onClick={() => navigate('/query/postgres')}>
            Quick Query →
          </button>
          <div className="dash-hero-conn-count">
            {connections.length} connection{connections.length !== 1 ? 's' : ''} saved
          </div>
        </div>
      </div>

      {/* ── No connections banner ── */}
      {connections.length === 0 && (
        <div className="dash-banner dash-fade-up" onClick={() => navigate('/connections')}>
          <div className="dash-banner-icon"><Link2 size={18} /></div>
          <div>
            <div className="dash-banner-title">Connect your first database</div>
            <div className="dash-banner-sub">Add a PostgreSQL, MongoDB, MySQL or Supabase connection to get started</div>
          </div>
          <ArrowRight size={18} className="dash-banner-arrow" />
        </div>
      )}

      {/* ── Quick Actions ── */}
      <section className="dash-section dash-fade-up">
        <h2 className="dash-section-title">Quick actions</h2>
        <div className="dash-actions-grid">
          {ACTIONS.map(({ label, desc, icon: Icon, color, grad, to }) => (
            <button
              key={to}
              className="dash-action-card"
              style={{ '--card-color': color, '--card-grad': grad }}
              onClick={() => navigate(to)}
            >
              <div className="dash-action-icon-box" style={{ background: grad }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div className="dash-action-text">
                <div className="dash-action-label">{label}</div>
                <div className="dash-action-desc">{desc}</div>
              </div>
              <div className="dash-action-arrow-box">
                <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="dash-section dash-fade-up">
        <h2 className="dash-section-title">How it works</h2>
        <div className="dash-how-grid">
          {HOW.map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="dash-how-card">
              <div className="dash-how-num">{n}</div>
              <div className="dash-how-icon-box">
                <Icon size={18} />
              </div>
              <div className="dash-how-title">{title}</div>
              <div className="dash-how-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
