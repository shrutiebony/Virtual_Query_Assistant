import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, Area, AreaChart
} from 'recharts';

// ── Theme ──────────────────────────────────────────────────────────────
const T = {
  bg:        '#0a0e1a',
  surface:   '#111827',
  surface2:  '#1a2234',
  border:    '#1e2d45',
  accent:    '#3b82f6',
  accentGlow:'rgba(59,130,246,0.15)',
  pass:      '#10b981',
  partial:   '#f59e0b',
  fail:      '#ef4444',
  error:     '#8b5cf6',
  text:      '#f1f5f9',
  textMuted: '#64748b',
  textDim:   '#94a3b8',
};

const DIFF_COLORS = {
  easy:    '#10b981',
  medium:  '#3b82f6',
  hard:    '#f59e0b',
  extreme: '#ef4444',
};

const STATUS_CONFIG = {
  PASS:    { color: T.pass,    bg: 'rgba(16,185,129,0.1)',  icon: '✓', label: 'Passed'  },
  PARTIAL: { color: T.partial, bg: 'rgba(245,158,11,0.1)',  icon: '◑', label: 'Partial' },
  FAIL:    { color: T.fail,    bg: 'rgba(239,68,68,0.1)',   icon: '✗', label: 'Failed'  },
  ERROR:   { color: T.error,   bg: 'rgba(139,92,246,0.1)',  icon: '⚡', label: 'Error'  },
};

async function fetchResults() {
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/benchmark/results`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('no_results');
  return resp.json();
}

// ── Animated counter ──────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    const duration = 1200;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(parseFloat(start.toFixed(1)));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

// ── Circular accuracy gauge ───────────────────────────────────────────
function AccuracyRing({ value }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const stroke = circ * 0.75 * (value / 100);
  const color = value >= 80 ? T.pass : value >= 60 ? T.partial : T.fail;

  return (
    <div style={{ position: 'relative', width: 180, height: 160 }}>
      <svg width={180} height={160} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={90} cy={100} r={r} fill="none"
          stroke={T.border} strokeWidth={8}
          strokeDasharray={`${circ * 0.75} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-225 90 100)"
        />
        {/* Progress */}
        <circle cx={90} cy={100} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${stroke} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-225 90 100)"
          filter="url(#glow)"
          style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Dot at end */}
        <circle cx={90} cy={30} r={4} fill={color} filter="url(#glow)"
          style={{ transformOrigin: '90px 100px',
            transform: `rotate(${-225 + (value/100)*270}deg)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 42, fontWeight: 900, color, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 20px ${color}60` }}>
          <AnimatedNumber value={value} suffix="%" />
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4,
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Accuracy
        </div>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }}/>
      <div style={{
        position: 'absolute', top: -40, right: -20, width: 100, height: 100,
        background: `radial-gradient(circle, ${color}15, transparent 70%)`,
        pointerEvents: 'none',
      }}/>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Difficulty progress bar ───────────────────────────────────────────
function DiffBar({ difficulty, data }) {
  const color = DIFF_COLORS[difficulty] || T.textMuted;
  const acc = data.accuracy || 0;
  const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme' };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${color}20`,
            border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color,
          }}>
            {labels[difficulty]?.[0]}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
              {labels[difficulty]}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted }}>
              {data.total} tasks · {data.passed}✓ {data.failed}✗ {data.errored}⚡
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 900, color,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {acc.toFixed(1)}%
        </div>
      </div>
      <div style={{
        height: 6, background: T.border, borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${acc}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 3,
          boxShadow: `0 0 8px ${color}60`,
          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
        }}/>
      </div>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────
function TaskRow({ result }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.ERROR;

  return (
    <div style={{
      border: `1px solid ${open ? cfg.color + '40' : T.border}`,
      borderRadius: 10, overflow: 'hidden', marginBottom: 6,
      background: open ? `${cfg.color}08` : T.surface,
      transition: 'all 0.2s',
    }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', cursor: 'pointer',
      }}>
        {/* Status badge */}
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: cfg.bg, border: `1px solid ${cfg.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: cfg.color, flexShrink: 0,
        }}>
          {cfg.icon}
        </div>

        {/* Difficulty pill */}
        <div style={{
          fontSize: 9, fontWeight: 800, color: DIFF_COLORS[result.difficulty],
          background: `${DIFF_COLORS[result.difficulty]}15`,
          border: `1px solid ${DIFF_COLORS[result.difficulty]}30`,
          borderRadius: 4, padding: '2px 6px',
          textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {result.difficulty}
        </div>

        {/* Question */}
        <div style={{
          flex: 1, fontSize: 12, color: T.textDim,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {result.question.split('\n')[0]}
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {result.react_attempts > 1 && (
            <div style={{
              fontSize: 10, color: T.partial,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              ↺ {result.react_attempts}x
            </div>
          )}
          <div style={{
            fontSize: 10, color: T.textMuted,
          }}>
            {result.elapsed_s}s
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: cfg.color,
            background: cfg.bg, borderRadius: 5, padding: '2px 8px',
          }}>
            {result.status}
          </div>
          <div style={{ color: T.textMuted, fontSize: 10 }}>
            {open ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {open && (
        <div style={{
          padding: '12px 14px',
          borderTop: `1px solid ${cfg.color}20`,
          background: T.bg,
        }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 10 }}>
            {result.detail}
          </div>

          {result.sql && (
            <pre style={{
              fontSize: 10, background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '10px 12px',
              overflow: 'auto', whiteSpace: 'pre-wrap',
              margin: '0 0 10px 0', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color: '#93c5fd', maxHeight: 140, lineHeight: 1.6,
            }}>
              {result.sql}
            </pre>
          )}

          {result.prediction?.length > 0 && result.gold?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted,
                  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Got
                </div>
                <pre style={{
                  fontSize: 10, background: cfg.bg,
                  border: `1px solid ${cfg.color}30`,
                  borderRadius: 6, padding: '8px 10px',
                  fontFamily: 'monospace', color: cfg.color,
                  margin: 0, overflow: 'auto',
                }}>
                  {JSON.stringify(result.prediction[0], null, 2)}
                </pre>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted,
                  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Expected
                </div>
                <pre style={{
                  fontSize: 10, background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 6, padding: '8px 10px',
                  fontFamily: 'monospace', color: T.pass,
                  margin: 0, overflow: 'auto',
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

// ── Main Dashboard ────────────────────────────────────────────────────
export default function BenchmarkDashboard() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all');
  const [diffFilter, setDiff]   = useState('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetchResults()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60vh', gap: 16, background: T.bg,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: `3px solid ${T.border}`,
        borderTop: `3px solid ${T.accent}`,
        animation: 'spin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 13, color: T.textMuted }}>Loading benchmark results...</div>
    </div>
  );

  if (error || !data) return (
    <div style={{
      padding: 60, textAlign: 'center', background: T.bg, minHeight: '60vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'rgba(59,130,246,0.1)',
        border: `1px solid rgba(59,130,246,0.2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, marginBottom: 20,
      }}>
        📊
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
        No benchmark results yet
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
        Run the benchmark against your local backend first
      </div>
      <pre style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: '12px 20px',
        fontSize: 12, color: '#93c5fd', fontFamily: 'monospace',
      }}>
        python benchmark_agent.py --limit 52
      </pre>
    </div>
  );

  const { total, passed, partial, failed, errored, accuracy, by_difficulty, results } = data;

  const selfCorrected = results.filter(r => r.self_corrected).length;
  const avgTime = (results.reduce((a, r) => a + (r.elapsed_s || 0), 0) / results.length).toFixed(1);

  const statusData = [
    { name: 'Passed',  value: passed,  color: T.pass    },
    { name: 'Partial', value: partial, color: T.partial },
    { name: 'Failed',  value: failed,  color: T.fail    },
    { name: 'Error',   value: errored, color: T.error   },
  ].filter(d => d.value > 0);

  const diffData = Object.entries(by_difficulty).map(([diff, d]) => ({
    name: diff.charAt(0).toUpperCase() + diff.slice(1),
    accuracy: d.accuracy, color: DIFF_COLORS[diff],
    passed: d.passed, failed: d.failed, errored: d.errored,
  }));

  const filteredResults = results.filter(r => {
    const s = filter === 'all' || r.status === filter.toUpperCase();
    const d = diffFilter === 'all' || r.difficulty === diffFilter;
    const q = !search || r.question.toLowerCase().includes(search.toLowerCase());
    return s && d && q;
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: '8px 12px', fontSize: 12, color: T.text,
      }}>
        <div style={{ fontWeight: 700 }}>{payload[0].payload.name}</div>
        <div style={{ color: payload[0].payload.color, marginTop: 2 }}>
          {payload[0].value.toFixed(1)}%
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: T.bg, minHeight: '100vh',
      padding: '24px', color: T.text,
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.surface} 0%, #0f1729 100%)`,
        border: `1px solid ${T.border}`,
        borderRadius: 16, padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: 24,
        marginBottom: 20, position: 'relative', overflow: 'hidden',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px', pointerEvents: 'none',
        }}/>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -60, right: 200, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)',
          pointerEvents: 'none',
        }}/>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 10, fontWeight: 700, color: T.accent,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: T.accent,
              boxShadow: `0 0 6px ${T.accent}`,
              animation: 'pulse 2s infinite',
            }}/>
            KDD Cup 2026 · DataAgent-Bench Phase 1
          </div>
          <style>{`
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          `}</style>
          <h1 style={{
            fontSize: 26, fontWeight: 900, margin: '0 0 6px 0',
            background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Database Assistant Benchmark
          </h1>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
            SJSU CMPE 295B · {total} tasks evaluated across 4 difficulty levels
          </p>
        </div>

        <AccuracyRing value={accuracy} />
      </div>

      {/* ── Metric cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 20,
      }}>
        <MetricCard icon="✅" label="Tasks Passed" value={passed}
          sub={`of ${total} total`} color={T.pass} />
        <MetricCard icon="⚡" label="Self-Corrected" value={selfCorrected}
          sub="via ReAct loop" color={T.error} />
        <MetricCard icon="⏱" label="Avg Response" value={`${avgTime}s`}
          sub="per task" color={T.accent} />
        <MetricCard icon="🎯" label="Hard Accuracy"
          value={`${by_difficulty.hard?.accuracy?.toFixed(0) || 0}%`}
          sub={`${by_difficulty.hard?.passed || 0} of ${by_difficulty.hard?.total || 0}`}
          color={T.partial} />
      </div>

      {/* ── Charts row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1.8fr',
        gap: 14, marginBottom: 20,
      }}>

        {/* Donut chart */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: '20px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
          }}>
            Result Distribution
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusData} dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72}
                  paddingAngle={3} strokeWidth={0}>
                  {statusData.map((e, i) => (
                    <Cell key={i} fill={e.color}/>
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => active && payload?.length ? (
                    <div style={{
                      background: T.surface2, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: '8px 12px', fontSize: 12,
                    }}>
                      <div style={{ color: payload[0].payload.color, fontWeight: 700 }}>
                        {payload[0].name}: {payload[0].value}
                      </div>
                    </div>
                  ) : null}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px',
            }}>
              {statusData.map(s => (
                <div key={s.name} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: s.color, flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 11, color: T.textDim, flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: '20px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
          }}>
            Accuracy by Difficulty
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={diffData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                {diffData.map((d, i) => (
                  <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={d.color} stopOpacity={1}/>
                    <stop offset="100%" stopColor={d.color} stopOpacity={0.4}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="name"
                tick={{ fontSize: 11, fill: T.textMuted }}
                axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: T.textMuted }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} domain={[0, 100]}/>
              <Tooltip content={<CustomTooltip />}/>
              <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {diffData.map((d, i) => (
                  <Cell key={i} fill={`url(#grad-${i})`}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Difficulty breakdown ── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: T.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20,
        }}>
          Difficulty Breakdown
        </div>
        {Object.entries(by_difficulty).map(([diff, d]) => (
          <DiffBar key={diff} difficulty={diff} data={d} />
        ))}
      </div>

      {/* ── Task results ── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: '20px 24px',
      }}>
        {/* Filters */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0,
          }}>
            Task Results
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..."
            style={{
              flex: 1, minWidth: 160, fontSize: 12, padding: '6px 12px',
              borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.bg, color: T.text, outline: 'none',
            }}
          />

          {/* Status filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'pass', 'partial', 'fail', 'error'].map(f => {
              const active = filter === f;
              const color = f === 'all' ? T.accent :
                f === 'pass' ? T.pass : f === 'partial' ? T.partial :
                f === 'fail' ? T.fail : T.error;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  fontSize: 10, fontWeight: 700, padding: '5px 10px',
                  borderRadius: 6, border: `1px solid ${active ? color + '60' : T.border}`,
                  background: active ? `${color}20` : 'transparent',
                  color: active ? color : T.textMuted,
                  cursor: 'pointer', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {f}
                </button>
              );
            })}
          </div>

          {/* Difficulty filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'easy', 'medium', 'hard', 'extreme'].map(d => {
              const active = diffFilter === d;
              const color = DIFF_COLORS[d] || T.accent;
              return (
                <button key={d} onClick={() => setDiff(d)} style={{
                  fontSize: 10, fontWeight: 700, padding: '5px 10px',
                  borderRadius: 6, border: `1px solid ${active ? color + '60' : T.border}`,
                  background: active ? `${color}20` : 'transparent',
                  color: active ? color : T.textMuted,
                  cursor: 'pointer', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {d}
                </button>
              );
            })}
          </div>

          <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 'auto', flexShrink: 0 }}>
            {filteredResults.length} / {total}
          </span>
        </div>

        {/* Task list */}
        <div style={{ maxHeight: 560, overflowY: 'auto',
          scrollbarWidth: 'thin', scrollbarColor: `${T.border} transparent` }}>
          {filteredResults.map(r => (
            <TaskRow key={r.task_id} result={r} />
          ))}
          {filteredResults.length === 0 && (
            <div style={{
              textAlign: 'center', padding: 40,
              color: T.textMuted, fontSize: 13,
            }}>
              No tasks match the current filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}