import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import {
  Database, Leaf, FolderOpen, Link2,
  ArrowRight, Zap, CheckCircle2, Sparkles,
  MessageSquare, BarChart2, Shield,
} from 'lucide-react';
import './DashboardPage.css';

const ACTIONS = [
  { label: 'PostgreSQL Query', desc: 'Ask your relational database in plain English', icon: Database,  color: 'blue',   to: '/query/postgres' },
  { label: 'MongoDB Query',    desc: 'Query collections with natural language',      icon: Leaf,      color: 'green',  to: '/query/mongo'    },
  { label: 'My Datasets',      desc: 'Upload CSV or Excel files and ask questions',  icon: FolderOpen,color: 'amber',  to: '/datasets'       },
  { label: 'Connections',      desc: 'Manage saved database connections',            icon: Link2,     color: 'purple', to: '/connections'    },
];

const HOW = [
  { n: '01', icon: MessageSquare, title: 'Ask in plain English',      desc: 'Type any question — no SQL knowledge required' },
  { n: '02', icon: Sparkles,      title: 'Gemini reads your schema',  desc: 'AI understands tables, columns & relationships' },
  { n: '03', icon: Shield,        title: 'Query is verified',         desc: 'Safety-checked before touching your database' },
  { n: '04', icon: BarChart2,     title: 'Results + insights',        desc: 'Tables, charts, and AI-powered EDA instantly' },
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

  const pg    = connections.filter(c => c.db_type === 'postgresql');
  const mongo = connections.filter(c => c.db_type === 'mongodb');
  const name  = user?.displayName || user?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="dash fade-in">

      {/* ── Hero greeting ── */}
      <div className="dash-hero">
        <div className="dash-hero-text">
          <div className="dash-eyebrow">{greeting()}</div>
          <h1 className="dash-hero-title">{name} <span className="dash-wave">👋</span></h1>
          <p className="dash-hero-sub">What would you like to explore today?</p>
        </div>

        <div className="dash-stats-row">
          <div className="dash-stat">
            <div className="dash-stat-val">{pg.length}</div>
            <div className="dash-stat-label">PostgreSQL</div>
          </div>
          <div className="dash-stat-div" />
          <div className="dash-stat">
            <div className="dash-stat-val">{mongo.length}</div>
            <div className="dash-stat-label">MongoDB</div>
          </div>
          <div className="dash-stat-div" />
          <div className="dash-stat">
            <div className="dash-stat-val dash-stat-active">
              <CheckCircle2 size={14} /> Active
            </div>
            <div className="dash-stat-label">AI pipeline</div>
          </div>
        </div>
      </div>

      {/* ── No connections banner ── */}
      {connections.length === 0 && (
        <div className="dash-banner" onClick={() => navigate('/connections')}>
          <div className="dash-banner-icon"><Link2 size={18} /></div>
          <div>
            <div className="dash-banner-title">Connect your first database</div>
            <div className="dash-banner-sub">Add a PostgreSQL or MongoDB connection to start querying with AI</div>
          </div>
          <ArrowRight size={18} className="dash-banner-arrow" />
        </div>
      )}

      {/* ── Quick actions ── */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Quick actions</h2>
        </div>
        <div className="dash-actions">
          {ACTIONS.map(({ label, desc, icon: Icon, color, to }) => (
            <button key={to} className={`dash-action dash-action-${color}`} onClick={() => navigate(to)}>
              <div className="dash-action-icon"><Icon size={20} /></div>
              <div className="dash-action-text">
                <div className="dash-action-label">{label}</div>
                <div className="dash-action-desc">{desc}</div>
              </div>
              <ArrowRight size={15} className="dash-action-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="dash-section">
        <h2 className="dash-section-title">How it works</h2>
        <div className="dash-how">
          {HOW.map(({ n, icon: Icon, title, desc }, i) => (
            <React.Fragment key={n}>
              <div className="dash-how-step">
                <div className="dash-how-num">{n}</div>
                <div className="dash-how-icon"><Icon size={18} /></div>
                <div className="dash-how-title">{title}</div>
                <div className="dash-how-desc">{desc}</div>
              </div>
              {i < HOW.length - 1 && <div className="dash-how-connector" />}
            </React.Fragment>
          ))}
        </div>
      </section>

    </div>
  );
}