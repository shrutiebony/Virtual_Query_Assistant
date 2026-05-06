import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import './BenchmarkDashboard.css';

// ── Status / difficulty config ────────────────────────────────────────
const STATUS_CONFIG = {
  PASS:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓', label: 'Passed'  },
  PARTIAL: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '◑', label: 'Partial' },
  FAIL:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '✗', label: 'Failed'  },
  ERROR:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '⚡', label: 'Error'  },
};

const DIFF_COLORS = {
  easy:    '#16a34a',
  medium:  '#2563eb',
  hard:    '#d97706',
  extreme: '#dc2626',
};

const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme' };

async function fetchResults() {
  const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API}/benchmark/results`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('no_results');
  return resp.json();
}

// ── Animated counter ──────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let cur = 0;
    const end = parseFloat(value);
    const step = end / (1200 / 16);
    const t = setInterval(() => {
      cur += step;
      if (cur >= end) { setDisplay(end); clearInterval(t); }
      else setDisplay(parseFloat(cur.toFixed(1)));
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <>{display}{suffix}</>;
}

// ── Accuracy ring ─────────────────────────────────────────────────────
function AccuracyRing({ value }) {
  const r = 70, circ = 2 * Math.PI * r;
  const stroke = circ * 0.75 * (value / 100);
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ position: 'relative', width: 180, height: 160 }}>
      <svg width={180} height={160} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx={90} cy={100} r={r} fill="none" stroke="rgba(255,255,255,0.15)"
          strokeWidth={8} strokeDasharray={`${circ * 0.75} ${circ}`}
          strokeLinecap="round" transform="rotate(-225 90 100)" />
        <circle cx={90} cy={100} r={r} fill="none" stroke={color}
          strokeWidth={8} strokeDasharray={`${stroke} ${circ}`}
          strokeLinecap="round" transform="rotate(-225 90 100)"
          filter="url(#ring-glow)"
          style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)' }} />
        <circle cx={90} cy={30} r={4} fill={color}
          style={{ transformOrigin: '90px 100px',
            transform: `rotate(${-225 + (value / 100) * 270}deg)` }} />
      </svg>
      <div className="bm-ring-label">
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 40,
          fontWeight: 900, color, lineHeight: 1 }}>
          <AnimatedNumber value={value} suffix="%" />
        </div>
        <div className="bm-ring-sub">Accuracy</div>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div className="bm-metric-card">
      <div className="bm-metric-bar" style={{ background: color }} />
      <div className="bm-metric-icon">{icon}</div>
      <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 26,
        fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="bm-metric-label">{label}</div>
      {sub && <div className="bm-metric-sub">{sub}</div>}
    </div>
  );
}

// ── Difficulty bar ────────────────────────────────────────────────────
function DiffBar({ difficulty, data }) {
  const color = DIFF_COLORS[difficulty] || '#6366f1';
  const acc = data.accuracy || 0;
  return (
    <div className="bm-diff-bar">
      <div className="bm-diff-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bm-diff-icon" style={{ color, background: `${color}12`,
            border: `1.5px solid ${color}25` }}>
            {DIFF_LABELS[difficulty]?.[0]}
          </div>
          <div>
            <div className="bm-diff-name">{DIFF_LABELS[difficulty]}</div>
            <div className="bm-diff-meta">
              {data.total} tasks &middot; {data.passed}✓ {data.failed}✗ {data.errored}⚡
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18,
          fontWeight: 700, color }}>
          {acc.toFixed(1)}%
        </div>
      </div>
      <div className="bm-diff-track">
        <div className="bm-diff-fill" style={{
          width: `${acc}%`,
          background: `linear-gradient(90deg, ${color}70, ${color})`,
        }} />
      </div>
    </div>
  );
}

// ── Task row (expandable) ─────────────────────────────────────────────
function TaskRow({ result }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.ERROR;
  const dc = DIFF_COLORS[result.difficulty] || '#6366f1';

  return (
    <div className="bm-task-row" style={{
      border: `1.5px solid ${open ? cfg.color + '30' : '#e4e4e7'}`,
      background: open ? cfg.bg : '#fff',
    }}>
      <div className="bm-task-header" onClick={() => setOpen(o => !o)}>
        <div className="bm-status-dot" style={{
          background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.color,
        }}>
          {cfg.icon}
        </div>

        <div className="bm-diff-pill" style={{
          color: dc, background: `${dc}12`, border: `1px solid ${dc}25`,
        }}>
          {result.difficulty}
        </div>

        <div className="bm-task-question">
          {result.question.split('\n')[0]}
        </div>

        <div className="bm-task-meta">
          {result.react_attempts > 1 && (
            <div className="bm-retry-badge">↺ {result.react_attempts}x</div>
          )}
          <div className="bm-time">{result.elapsed_s}s</div>
          <div className="bm-status-badge" style={{
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
          }}>
            {result.status}
          </div>
          <div className="bm-chevron">{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div className="bm-task-detail" style={{ borderTop: `1px solid ${cfg.border}` }}>
          {result.detail && (
            <div className="bm-detail-text">{result.detail}</div>
          )}
          {result.sql && (
            <pre className="bm-sql-block">{result.sql}</pre>
          )}
          {result.prediction?.length > 0 && result.gold?.length > 0 && (
            <div className="bm-compare">
              <div>
                <div className="bm-compare-label">Got</div>
                <pre className="bm-compare-pre" style={{
                  background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
                }}>
                  {JSON.stringify(result.prediction[0], null, 2)}
                </pre>
              </div>
              <div>
                <div className="bm-compare-label">Expected</div>
                <pre className="bm-compare-pre" style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a',
                }}>
                  {JSON.stringify(result.gold[0], null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────
function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bm-tooltip">
      <div className="bm-tooltip-name">{payload[0].payload.name}</div>
      <div style={{ color: payload[0].payload.color, fontWeight: 700, marginTop: 2 }}>
        {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) + '%' : payload[0].value}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function BenchmarkDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');
  const [diffFilter, setDiff] = useState('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    fetchResults().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bm-center">
      <div className="bm-spinner" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div className="bm-loading-text">Loading benchmark results…</div>
    </div>
  );

  if (error || !data) return (
    <div className="bm-center">
      <div className="bm-empty-icon">📊</div>
      <div className="bm-empty-title">No benchmark results yet</div>
      <div className="bm-empty-sub">Run the benchmark against your local backend first</div>
      <pre className="bm-empty-cmd">python benchmark_agent.py --limit 52</pre>
    </div>
  );

  const { total, passed, partial = 0, failed, errored, accuracy, by_difficulty, results } = data;
  const selfCorrected = results.filter(r => r.self_corrected).length;
  const avgTime = (results.reduce((a, r) => a + (r.elapsed_s || 0), 0) / results.length).toFixed(1);

  const statusData = [
    { name: 'Passed',  value: passed,  color: '#16a34a' },
    { name: 'Partial', value: partial, color: '#d97706' },
    { name: 'Failed',  value: failed,  color: '#dc2626' },
    { name: 'Error',   value: errored, color: '#7c3aed' },
  ].filter(d => d.value > 0);

  const diffData = Object.entries(by_difficulty).map(([diff, d]) => ({
    name: DIFF_LABELS[diff] || diff,
    accuracy: d.accuracy,
    color: DIFF_COLORS[diff] || '#6366f1',
  }));

  const filteredResults = results.filter(r => {
    const s = filter === 'all' || r.status === filter.toUpperCase();
    const d = diffFilter === 'all' || r.difficulty === diffFilter;
    const q = !search || r.question.toLowerCase().includes(search.toLowerCase());
    return s && d && q;
  });

  return (
    <div className="bm-page">

      {/* ── Hero — dark, matching DashboardPage ── */}
      <div className="bm-hero">
        <div className="bm-hero-grid" />
        <div className="bm-hero-glow" />
        <div className="bm-hero-text">
          <div className="bm-hero-eyebrow">
            <span className="bm-eyebrow-dot" />
            DataAgent-Bench · Phase 1
          </div>
          <h1 className="bm-hero-title">Benchmark Results</h1>
          <p className="bm-hero-sub">
            SJSU CMPE 295B &middot; {total} tasks across 4 difficulty levels
          </p>
        </div>
        <AccuracyRing value={accuracy} />
      </div>

      {/* ── Metric cards ── */}
      <div className="bm-metrics">
        <MetricCard icon="✅" label="Tasks Passed" value={passed}
          sub={`of ${total} total`} color="#16a34a" />
        <MetricCard icon="⚡" label="Self-Corrected" value={selfCorrected}
          sub="via ReAct loop" color="#7c3aed" />
        <MetricCard icon="⏱" label="Avg Response" value={`${avgTime}s`}
          sub="per task" color="#6366f1" />
        <MetricCard icon="🎯" label="Hard Accuracy"
          value={`${by_difficulty.hard?.accuracy?.toFixed(0) || 0}%`}
          sub={`${by_difficulty.hard?.passed || 0} of ${by_difficulty.hard?.total || 0}`}
          color="#d97706" />
      </div>

      {/* ── Charts ── */}
      <div className="bm-charts">

        {/* Donut */}
        <div className="bm-card">
          <div className="bm-card-title">Result Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} dataKey="value"
                cx="50%" cy="50%" innerRadius={46} outerRadius={70}
                paddingAngle={3} strokeWidth={0}>
                {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div className="bm-tooltip">
                  <span style={{ color: payload[0].payload.color, fontWeight: 700 }}>
                    {payload[0].name}: {payload[0].value}
                  </span>
                </div>
              ) : null} />
            </PieChart>
          </ResponsiveContainer>
          <div className="bm-legend">
            {statusData.map(s => (
              <div key={s.name} className="bm-legend-item">
                <div className="bm-legend-dot" style={{ background: s.color }} />
                <span className="bm-legend-name">{s.name}</span>
                <span className="bm-legend-val" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="bm-card">
          <div className="bm-card-title">Accuracy by Difficulty</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={diffData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                {diffData.map((d, i) => (
                  <linearGradient key={i} id={`bg-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={d.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={d.color} stopOpacity={0.35} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a', fontFamily: "'DM Sans',sans-serif" }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa', fontFamily: "'DM Sans',sans-serif" }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {diffData.map((d, i) => <Cell key={i} fill={`url(#bg-${i})`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Difficulty breakdown ── */}
      <div className="bm-card bm-breakdown">
        <div className="bm-card-title">Difficulty Breakdown</div>
        {Object.entries(by_difficulty).map(([diff, d]) => (
          <DiffBar key={diff} difficulty={diff} data={d} />
        ))}
      </div>

      {/* ── Task results ── */}
      <div className="bm-card">
        <div className="bm-filters">
          <div className="bm-card-title" style={{ margin: 0 }}>Task Results</div>

          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="bm-search"
          />

          <div className="bm-filter-group">
            {['all', 'pass', 'partial', 'fail', 'error'].map(f => {
              const active = filter === f;
              const cfg = f === 'all' ? { color: '#6366f1' } :
                f === 'pass' ? STATUS_CONFIG.PASS : f === 'partial' ? STATUS_CONFIG.PARTIAL :
                f === 'fail' ? STATUS_CONFIG.FAIL : STATUS_CONFIG.ERROR;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`bm-filter-btn ${active ? 'active' : ''}`}
                  style={active ? { color: cfg.color, background: cfg.bg || `${cfg.color}12`,
                    borderColor: `${cfg.color}30` } : {}}>
                  {f}
                </button>
              );
            })}
          </div>

          <div className="bm-filter-group">
            {['all', 'easy', 'medium', 'hard', 'extreme'].map(d => {
              const active = diffFilter === d;
              const color = DIFF_COLORS[d] || '#6366f1';
              return (
                <button key={d} onClick={() => setDiff(d)}
                  className={`bm-filter-btn ${active ? 'active' : ''}`}
                  style={active ? { color, background: `${color}12`, borderColor: `${color}30` } : {}}>
                  {d}
                </button>
              );
            })}
          </div>

          <span className="bm-count">{filteredResults.length} / {total}</span>
        </div>

        <div className="bm-task-list">
          {filteredResults.map(r => <TaskRow key={r.task_id} result={r} />)}
          {filteredResults.length === 0 && (
            <div className="bm-no-results">No tasks match the current filter</div>
          )}
        </div>
      </div>

    </div>
  );
}
