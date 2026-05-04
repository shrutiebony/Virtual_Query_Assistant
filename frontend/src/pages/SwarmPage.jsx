import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { authAPI } from '../services/api';
import { swarmAPI } from '../services/swarmApi';
import { Badge } from '../components/ui';
import { Database, Leaf, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import './ChatQueryPage.css';

const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#14b8a6','#a855f7','#ef4444','#f97316','#06b6d4'];
const CARD_COLORS  = ['#6366f1','#22c55e','#f59e0b','#14b8a6'];

const SAMPLE_QUESTIONS = [
  'Give me a full business analysis of orders and customers',
  'Analyze revenue trends and top performing segments',
  'Show customer behavior patterns and order statistics',
  'Compare performance across all dimensions of the data',
];

const DB_TYPES = [
  { id: 'postgresql', label: 'PostgreSQL', icon: <Database size={13}/>, color: '#3b82f6' },
  { id: 'mysql',      label: 'MySQL',      icon: <Database size={13}/>, color: '#f59e0b' },
  { id: 'mongodb',    label: 'MongoDB',    icon: <Leaf size={13}/>,     color: '#22c55e' },
];

/* ── Bar chart for a single result ──────────────────────── */
function ResultBarChart({ data, color, height = 220 }) {
  if (!data?.length) return null;

  const allCols  = Object.keys(data[0]);
  const numCols  = allCols.filter(k => typeof data[0][k] === 'number');
  const textCols = allCols.filter(k => typeof data[0][k] !== 'number');

  if (!numCols.length) return null;

  const xCol = textCols[0] || allCols[0];
  const gradId = `grad_${color.replace('#','')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{top:8, right:12, left:0, bottom:4}}>
        <defs>
          {numCols.slice(0,2).map((k, i) => (
            <linearGradient key={k} id={`${gradId}_${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={CHART_COLORS[i]} stopOpacity={0.95}/>
              <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0.45}/>
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f7" vertical={false}/>
        <XAxis
          dataKey={xCol}
          tick={{fontSize:10, fill:'#6b7591'}}
          tickLine={false}
          axisLine={{stroke:'#e5e7eb'}}
        />
        <YAxis
          tick={{fontSize:10, fill:'#6b7591'}}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => Number(v).toLocaleString()}
        />
        <Tooltip
          contentStyle={{
            borderRadius:10, border:'1px solid #e5e7eb',
            boxShadow:'0 4px 16px rgba(0,0,0,0.1)', fontSize:12,
          }}
          formatter={v => [Number(v).toLocaleString()]}
        />
        <Legend wrapperStyle={{fontSize:11, paddingTop:8}}/>
        {numCols.slice(0,2).map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            fill={`url(#${gradId}_${i})`}
            radius={[6,6,0,0]}
            maxBarSize={56}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Stats row for a single result ──────────────────────── */
function ResultStats({ data, columns, color }) {
  if (!data?.length) return null;
  const numCols = columns.filter(c => typeof data[0]?.[c] === 'number');
  if (!numCols.length) return null;

  const stats = numCols.slice(0, 3).map(col => {
    const vals  = data.map(r => Number(r[col])).filter(v => !isNaN(v));
    const total = vals.reduce((a,b) => a+b, 0);
    const avg   = vals.length ? total / vals.length : 0;
    const max   = Math.max(...vals);
    return { col, total, avg, max };
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(stats.length * 3, 9)}, 1fr)`,
      gap: 8, marginBottom: 14,
    }}>
      {stats.map(s => (
        [
          { label: 'Total', value: s.total },
          { label: 'Avg',   value: s.avg   },
          { label: 'Max',   value: s.max   },
        ].map(({ label, value }) => (
          <div key={`${s.col}_${label}`} style={{
            background: `${color}08`,
            border: `1px solid ${color}20`,
            borderRadius: 8, padding: '6px 10px', textAlign: 'center',
          }}>
            <div style={{fontSize:9, color:'#9ca3af', marginBottom:2}}>
              {s.col.replace(/_/g,' ')} {label}
            </div>
            <div style={{fontSize:13, fontWeight:700, color}}>
              {Number(value).toLocaleString(undefined, {maximumFractionDigits:1})}
            </div>
          </div>
        ))
      ))}
    </div>
  );
}

/* ── Individual subtask card ─────────────────────────────── */
function SubtaskCard({ result, index }) {
  const [showTable, setShowTable] = useState(false);
  const isError = !!result.error;
  const color   = CARD_COLORS[index % CARD_COLORS.length];

  const allCols  = result.columns || [];
  const numCols  = allCols.filter(c => typeof result.data?.[0]?.[c] === 'number');
  const hasChart = !isError && result.data?.length > 0 && numCols.length > 0;

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${color}30`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 6px 20px ${color}20`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Card header */}
      <div style={{
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
        borderBottom: `1px solid ${color}20`,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: color, color: '#fff',
          fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: `0 3px 8px ${color}40`,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
            {result.question}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {isError ? (
              <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2',
                border: '1px solid #fca5a5', borderRadius: 5, padding: '1px 7px' }}>
                ✗ Failed
              </span>
            ) : (
              <>
                <span style={{ fontSize: 11, color: color, background: `${color}12`,
                  border: `1px solid ${color}30`, borderRadius: 5, padding: '1px 7px',
                  fontWeight: 600 }}>
                  ✓ {result.count} rows
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {result.execution_time_ms}ms
                </span>
                {result.react_trace?.attempts > 1 && (
                  <span style={{ fontSize: 10, color: '#d97706', background: '#fffbeb',
                    border: '1px solid #fcd34d', borderRadius: 5, padding: '1px 6px' }}>
                    🔄 {result.react_trace.attempts} attempts
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      {!isError && (
        <div style={{ padding: '16px 18px' }}>

          {/* Stats row */}
          <ResultStats data={result.data} columns={result.columns} color={color}/>

          {/* Bar chart */}
          {hasChart && (
            <div style={{
              background: '#fafafa', borderRadius: 10,
              padding: '12px 8px 8px', marginBottom: 14,
              border: '1px solid #f3f4f6',
            }}>
              <ResultBarChart data={result.data} color={color} height={220}/>
            </div>
          )}

          {/* SQL */}
          {result.sql && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
              }}>
                Generated SQL
              </div>
              <pre style={{
                fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: '10px 14px', overflow: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                fontFamily: 'monospace', color: '#1e1b4b', lineHeight: 1.6,
              }}>
                {result.sql}
              </pre>
            </div>
          )}

          {/* Data table toggle */}
          {result.data?.length > 0 && (
            <>
              <button
                onClick={() => setShowTable(t => !t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 600, color: color,
                  background: `${color}10`, border: `1px solid ${color}25`,
                  borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                  marginBottom: showTable ? 10 : 0,
                }}
              >
                {showTable ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                {showTable ? 'Hide' : 'Show'} data table ({result.count} rows)
              </button>

              {showTable && (
                <div style={{ overflowX: 'auto', borderRadius: 8,
                  border: '1px solid #e5e7eb', maxHeight: 280, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        {result.columns.map(c => (
                          <th key={c} style={{
                            padding: '8px 14px', textAlign: 'left',
                            fontWeight: 700, color: '#374151',
                            borderBottom: '2px solid #e5e7eb',
                            background: '#f9fafb', whiteSpace: 'nowrap',
                            fontSize: 11,
                          }}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((row, i) => (
                        <tr key={i} style={{
                          background: i % 2 === 0 ? 'white' : '#fafafa',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = `${color}08`}
                          onMouseLeave={e => e.currentTarget.style.background = i%2===0?'white':'#fafafa'}
                        >
                          {result.columns.map(c => (
                            <td key={c} style={{
                              padding: '7px 14px',
                              borderBottom: '1px solid #f3f4f6',
                              color: '#374151',
                            }}>
                              {row[c] == null
                                ? <span style={{ color: '#d1d5db' }}>null</span>
                                : typeof row[c] === 'number'
                                  ? <strong style={{ color }}>{Number(row[c]).toLocaleString()}</strong>
                                  : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div style={{ padding: '14px 18px' }}>
          <div style={{
            color: '#dc2626', fontSize: 12, background: '#fef2f2',
            border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: 8,
          }}>
            {result.error}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Summary card ────────────────────────────────────────── */
function SummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Headline */}
      {summary.headline && (
        <div style={{
          background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
          border: '1.5px solid #e0e7ff', borderRadius: 12,
          padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: '#6366f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0, boxShadow: '0 3px 10px rgba(99,102,241,0.3)',
          }}>💡</div>
          <div>
            <div style={{fontSize:10, fontWeight:700, color:'#6366f1',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>
              Swarm Intelligence Summary
            </div>
            <div style={{fontSize:13, color:'#374151', lineHeight:1.7, fontWeight:500}}>
              {summary.headline}
            </div>
          </div>
        </div>
      )}

      {/* Executive summary */}
      {summary.executive_summary && (
        <div style={{background:'#fff', border:'1.5px solid #e5e7eb',
          borderRadius:12, padding:'16px 18px'}}>
          <div style={{fontSize:11, fontWeight:700, color:'#374151',
            textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10}}>
            📋 Executive Summary
          </div>
          <div style={{fontSize:13, color:'#374151', lineHeight:1.7}}>
            {summary.executive_summary}
          </div>
        </div>
      )}

      {/* Insights + Recommendations */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        {Array.isArray(summary.key_insights) && summary.key_insights.length > 0 && (
          <div style={{background:'#fff', border:'1.5px solid #e5e7eb',
            borderRadius:12, padding:'16px 18px'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#374151',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12}}>
              🔍 Key Insights
            </div>
            {summary.key_insights.map((insight, i) => (
              <div key={i} style={{display:'flex', alignItems:'flex-start',
                gap:10, marginBottom:12, paddingBottom:12,
                borderBottom: i < summary.key_insights.length-1 ? '1px solid #f3f4f6' : 'none'}}>
                <span style={{
                  minWidth:22, height:22,
                  background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color:'#fff', borderRadius:6, fontSize:11, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, marginTop:1,
                }}>{i+1}</span>
                <span style={{fontSize:12, color:'#374151', lineHeight:1.6}}>{insight}</span>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(summary.recommendations) && summary.recommendations.length > 0 && (
          <div style={{background:'linear-gradient(135deg,#f0fdf4,#ecfeff)',
            border:'1.5px solid #86efac', borderRadius:12, padding:'16px 18px'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#16a34a',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12}}>
              ✨ Recommendations
            </div>
            {summary.recommendations.map((rec, i) => (
              <div key={i} style={{display:'flex', alignItems:'flex-start',
                gap:10, marginBottom:12}}>
                <span style={{
                  width:22, height:22, borderRadius:'50%',
                  background:'#f0fdf4', border:'1.5px solid #86efac',
                  color:'#16a34a', fontSize:13, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, marginTop:1,
                }}>→</span>
                <span style={{fontSize:12, color:'#374151', lineHeight:1.6}}>{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main SwarmPage ──────────────────────────────────────── */
export default function SwarmPage() {
  const [dbType, setDbType]             = useState('postgresql');
  const [connections, setConnections]   = useState([]);
  const [selectedConn, setSelectedConn] = useState('');
  const [question, setQuestion]         = useState('');
  const [maxSubtasks, setMaxSubtasks]   = useState(3);
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState('');
  const [mongoCollections, setMongoCollections]       = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);

  useEffect(() => {
    authAPI.connections().then(r => {
      const filtered = (r.data||[]).filter(c => c.db_type === dbType);
      setConnections(filtered);
      setSelectedConn(filtered.length ? String(filtered[0].id) : '');
      setResult(null); setError('');
      setMongoCollections([]); setSelectedCollections([]);
    }).catch(() => {});
  }, [dbType]);

  const conn = connections.find(c => String(c.id) === String(selectedConn));

  useEffect(() => {
    if (dbType !== 'mongodb' || !conn) return;
    setMongoCollections([]); setSelectedCollections([]);
    authAPI.getPassword(conn.id).then(r => {
      const uri = r.data?.password;
      if (!uri) return;
      const base  = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      fetch(`${base}/mongo/collections?mongo_uri=${encodeURIComponent(uri)}&db_name=${conn.dbname}`,
        { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const colls = data.collections || [];
          setMongoCollections(colls);
          setSelectedCollections(colls.slice(0, 2));
        }).catch(() => {});
    }).catch(() => {});
  }, [selectedConn, dbType]);

  const run = async () => {
    if (!question.trim() || !conn) return;
    setLoading(true); setError(''); setResult(null);
    try {
      let res;
      if (dbType === 'postgresql') {
        const uriRes = await authAPI.getUri(conn.id);
        const pg_uri = uriRes.data?.uri;
        if (!pg_uri) throw new Error('Could not get connection URI');
        res = await swarmAPI.pgQuery({
          pg_uri, question: question.trim(), limit: 50, max_subtasks: maxSubtasks,
        });
      } else if (dbType === 'mysql') {
        const pwRes    = await authAPI.getPassword(conn.id);
        const password = pwRes.data?.password || '';
        res = await swarmAPI.mysqlQuery({
          host: conn.host, port: conn.port,
          database: conn.dbname, username: conn.db_username, password,
          question: question.trim(), limit: 50, max_subtasks: maxSubtasks,
        });
      } else if (dbType === 'mongodb') {
        const pwRes     = await authAPI.getPassword(conn.id);
        const mongo_uri = pwRes.data?.password;
        if (!mongo_uri) throw new Error('Could not get connection URI');
        res = await swarmAPI.mongoQuery({
          mongo_uri, db_name: conn.dbname,
          collections: selectedCollections.length > 0 ? selectedCollections : mongoCollections.slice(0,2),
          question: question.trim(), limit: 50, max_subtasks: maxSubtasks,
        });
      }
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Swarm query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-query-page fade-in">

      {/* ── Left panel ── */}
      <div className="cqp-left">
        <div className="cqp-section">
          <div className="cqp-section-label">Database Type</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {DB_TYPES.map(db => (
              <button key={db.id} onClick={() => setDbType(db.id)} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 12px', borderRadius:8, border:'1.5px solid',
                fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                borderColor: dbType===db.id ? db.color : '#e5e7eb',
                background:  dbType===db.id ? `${db.color}12` : '#fff',
                color:       dbType===db.id ? db.color : '#6b7280',
              }}>
                {db.icon} {db.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cqp-section">
          <div className="cqp-section-label">Connection</div>
          {connections.length === 0 ? (
            <div className="cqp-empty-note">
              No {dbType} connections.{' '}
              <a href="/connections" style={{color:'var(--accent)'}}>Add one</a>
            </div>
          ) : (
            <select className="cqp-select" value={selectedConn}
              onChange={e => setSelectedConn(e.target.value)}>
              {connections.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name||c.dbname}</option>
              ))}
            </select>
          )}
        </div>

        {dbType === 'mongodb' && mongoCollections.length > 0 && (
          <div className="cqp-section">
            <div className="cqp-section-label">Collections</div>
            <div className="cqp-checklist">
              {mongoCollections.map(c => (
                <label key={c} className={`cqp-check-item ${selectedCollections.includes(c)?'on':''}`}>
                  <input type="checkbox" checked={selectedCollections.includes(c)}
                    onChange={() => setSelectedCollections(prev =>
                      prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c]
                    )}/>
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="cqp-section">
          <div className="cqp-section-label">Parallel Agents</div>
          <div style={{display:'flex', gap:6}}>
            {[2,3,4].map(n => (
              <button key={n} onClick={() => setMaxSubtasks(n)} style={{
                flex:1, padding:'6px 0', borderRadius:8, border:'1.5px solid',
                fontSize:13, fontWeight:700, cursor:'pointer',
                borderColor: maxSubtasks===n ? '#6366f1' : '#e5e7eb',
                background:  maxSubtasks===n ? '#eef2ff' : '#fff',
                color:       maxSubtasks===n ? '#6366f1' : '#6b7280',
              }}>
                {n}
              </button>
            ))}
          </div>
          <div style={{fontSize:11, color:'#9ca3af', marginTop:6}}>
            {maxSubtasks} agents will run simultaneously
          </div>
        </div>

        <div className="cqp-section cqp-suggestions">
          <div className="cqp-section-label"><Zap size={11}/> Sample questions</div>
          {SAMPLE_QUESTIONS.map(s => (
            <button key={s} className="cqp-suggestion" onClick={() => setQuestion(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="cqp-right">
        <div className="cqp-chat-header">
          <Zap size={15} color="#6366f1"/>
          <span>Swarm Agents</span>
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
            <span style={{
              fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:6,
              background: dbType==='postgresql'?'#dbeafe': dbType==='mysql'?'#fef3c7':'#dcfce7',
              color:      dbType==='postgresql'?'#1d4ed8': dbType==='mysql'?'#b45309':'#15803d',
            }}>
              {dbType.toUpperCase()}
            </span>
            <Badge color="blue">{conn?.name||'No connection'}</Badge>
          </div>
        </div>

        <div className="cqp-messages" style={{padding:'20px 24px'}}>

          {/* Welcome */}
          {!result && !loading && !error && (
            <div className="cqp-welcome">
              <Zap size={28} color="#6366f1"/>
              <div className="cqp-welcome-title">Swarm Parallel Agents</div>
              <div className="cqp-welcome-sub">
                Ask a complex question — multiple agents run simultaneously and each
                produces its own analysis with charts and insights
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{textAlign:'center', padding:'60px 20px'}}>
              <div style={{display:'flex', justifyContent:'center', gap:16, marginBottom:20}}>
                {Array.from({length:maxSubtasks}).map((_,i) => (
                  <div key={i} style={{
                    width:44, height:44, borderRadius:'50%',
                    background: CARD_COLORS[i%4],
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:800, fontSize:15,
                    boxShadow:`0 4px 12px ${CARD_COLORS[i%4]}50`,
                    animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`,
                  }}>
                    {i+1}
                  </div>
                ))}
              </div>
              <div style={{fontSize:15, fontWeight:700, color:'#374151', marginBottom:6}}>
                {maxSubtasks} agents running in parallel on {dbType}...
              </div>
              <div style={{fontSize:12, color:'#9ca3af'}}>
                Planning subtasks → Executing queries → Generating summary
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{padding:'14px 18px', background:'#fef2f2',
              border:'1px solid #fecaca', borderRadius:10, color:'#dc2626', fontSize:13}}>
              ⚠️ {error}
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div style={{display:'flex', flexDirection:'column', gap:20}}>

              {/* Stats bar */}
              <div style={{
                display:'grid', gridTemplateColumns:'repeat(4,1fr)',
                gap:10, padding:'14px 16px',
                background:'linear-gradient(135deg,#f9fafb,#f3f4f6)',
                borderRadius:12, border:'1px solid #e5e7eb',
              }}>
                {[
                  {label:'Agents Run',  value:result.agents_run,       color:'#6366f1', icon:'🤖'},
                  {label:'Succeeded',   value:result.agents_succeeded,  color:'#16a34a', icon:'✓'},
                  {label:'Total Time',  value:`${(result.total_ms/1000).toFixed(1)}s`, color:'#0891b2', icon:'⏱'},
                  {label:'Subtasks',    value:result.subtasks?.length,  color:'#f59e0b', icon:'⚡'},
                ].map(s => (
                  <div key={s.label} style={{
                    background:'#fff', borderRadius:10, padding:'12px 14px',
                    border:`1.5px solid ${s.color}20`, textAlign:'center',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{fontSize:16, marginBottom:4}}>{s.icon}</div>
                    <div style={{fontSize:22, fontWeight:800, color:s.color, lineHeight:1}}>
                      {s.value}
                    </div>
                    <div style={{fontSize:10, color:'#6b7280', marginTop:3, fontWeight:500}}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unified summary */}
              <SummaryCard summary={result.summary}/>

              {/* Individual agent results — each with its own chart */}
              <div>
                <div style={{
                  display:'flex', alignItems:'center', gap:8, marginBottom:14,
                }}>
                  <div style={{width:4, height:18, background:'#6366f1', borderRadius:2}}/>
                  <span style={{fontSize:12, fontWeight:700, color:'#374151',
                    textTransform:'uppercase', letterSpacing:'0.06em'}}>
                    Individual Agent Results
                  </span>
                  <span style={{fontSize:11, color:'#9ca3af'}}>
                    — each agent ran independently in parallel
                  </span>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:14}}>
                  {result.subtask_results.map((r,i) => (
                    <SubtaskCard key={i} result={r} index={i}/>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="cqp-input-bar">
          <textarea
            className="cqp-textarea"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();run();} }}
            placeholder={`Ask a complex question about your ${dbType} data...`}
            rows={1}
            disabled={loading}
          />
          <button className="cqp-send-btn" onClick={run}
            disabled={loading||!question.trim()||!conn}>
            <Zap size={15}/>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform:translateY(0); }
          40% { transform:translateY(-12px); }
        }
      `}</style>
    </div>
  );
}