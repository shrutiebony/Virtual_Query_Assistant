// src/components/ui/AiFunctionsPanel.jsx
// Simulates AlloyDB's ai.generate, ai.if, ai.rank — with inline results table + smart suggestions

import React, { useState, useEffect } from 'react';
import { Sparkles, Filter, ArrowUpDown, Loader2, RotateCcw, Lightbulb } from 'lucide-react';
import api from '../../services/api';

const TABS = [
  { id: 'generate', label: 'ai.generate', icon: <Sparkles size={13}/>, color: '#7c3aed',
    desc: 'Add AI-generated insights as a new column to every row' },
  { id: 'if',       label: 'ai.if',       icon: <Filter size={13}/>,   color: '#0891b2',
    desc: 'Filter rows using a natural language condition' },
  { id: 'rank',     label: 'ai.rank',     icon: <ArrowUpDown size={13}/>, color: '#059669',
    desc: 'Reorder rows by semantic relevance' },
];

const PLACEHOLDERS = {
  generate: 'e.g. Summarize this row and classify the severity level',
  if:       'e.g. Is this revenue above average?',
  rank:     'e.g. Rank by highest revenue first',
};

const LIMITS = { generate: 100, if: 200, rank: 50 };

/* ── Smart suggestion generator ─────────────────────────────── */
function buildSuggestions(data, tabId) {
  if (!data?.length) return [];
  const cols    = Object.keys(data[0]);
  const numCols = cols.filter(c => typeof data[0][c] === 'number');
  const strCols = cols.filter(c => typeof data[0][c] === 'string');
  const sample  = data[0];

  // Pick most meaningful columns
  const mainNum = numCols[0] || cols[0];
  const mainStr = strCols[0] || cols[0];
  const secNum  = numCols[1] || numCols[0];

  // Get a sample value for context
  const sampleNumVal = mainNum ? Number(sample[mainNum]) : null;
  const sampleStrVal = mainStr ? String(sample[mainStr]) : null;

  if (tabId === 'generate') {
    const suggestions = [];
    if (numCols.length > 0 && strCols.length > 0) {
      suggestions.push(`Classify ${mainStr} as High, Medium, or Low based on ${mainNum} and explain why`);
    }
    if (numCols.length > 0) {
      suggestions.push(`Write a one-sentence business insight about the ${mainNum} value for this row`);
    }
    if (strCols.length > 0) {
      suggestions.push(`Generate a short action recommendation based on this ${mainStr} data`);
    }
    if (suggestions.length < 3) {
      suggestions.push(`Summarize this row in plain English and highlight any notable values`);
    }
    return suggestions.slice(0, 3);
  }

  if (tabId === 'if') {
    const suggestions = [];
    if (sampleNumVal !== null && mainNum) {
      const threshold = Math.round(sampleNumVal * 0.8);
      suggestions.push(`Is the ${mainNum} greater than ${threshold}?`);
    }
    if (strCols.length > 0 && sampleStrVal) {
      suggestions.push(`Does this ${mainStr} indicate a positive or successful outcome?`);
    }
    if (numCols.length > 0) {
      suggestions.push(`Is this a high-value record worth prioritizing?`);
    }
    if (suggestions.length < 3) {
      suggestions.push(`Is this record an outlier compared to typical values?`);
    }
    return suggestions.slice(0, 3);
  }

  if (tabId === 'rank') {
    const suggestions = [];
    if (numCols.length > 0) {
      suggestions.push(`Rank by highest ${mainNum} first`);
    }
    if (numCols.length > 1) {
      suggestions.push(`Rank by best overall performance considering both ${mainNum} and ${secNum}`);
    }
    if (strCols.length > 0) {
      suggestions.push(`Rank by most important ${mainStr} to follow up on`);
    }
    if (suggestions.length < 3) {
      suggestions.push(`Rank by highest business priority and urgency`);
    }
    return suggestions.slice(0, 3);
  }

  return [];
}

/* ── Inline Result Table ─────────────────────────────────────── */
function ResultTable({ rows, highlightCol }) {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);

  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                color: c === highlightCol ? '#7c3aed' : '#374151',
                borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
                background: c === highlightCol ? '#f5f3ff' : '#f9fafb',
              }}>
                {c === highlightCol ? '✨ ' : ''}{c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
              {cols.map(c => (
                <td key={c} style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f3f4f6',
                  color: c === highlightCol ? '#5b21b6' : '#374151',
                  background: c === highlightCol ? '#faf5ff' : 'transparent',
                  fontStyle: c === highlightCol ? 'italic' : 'normal',
                  maxWidth: c === highlightCol ? '280px' : '160px',
                  whiteSpace: c === highlightCol ? 'normal' : 'nowrap',
                  overflow: 'hidden',
                  textOverflow: c === highlightCol ? 'clip' : 'ellipsis',
                }}>
                  {row[c] == null
                    ? <span style={{ color: '#d1d5db' }}>null</span>
                    : typeof row[c] === 'number'
                      ? <strong>{Number(row[c]).toLocaleString()}</strong>
                      : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Suggestion Pills ────────────────────────────────────────── */
function SuggestionPills({ suggestions, onSelect, color }) {
  if (!suggestions?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.06em'
      }}>
        <Lightbulb size={12} color={color}/>
        Suggested queries
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onSelect(s)}
            style={{
              textAlign: 'left', padding: '8px 12px',
              background: '#fff', border: `1.5px solid ${color}25`,
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
              color: '#374151', lineHeight: 1.5,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${color}08`;
              e.currentTarget.style.borderColor = `${color}60`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = `${color}25`;
            }}
          >
            <span style={{
              minWidth: 20, height: 20, borderRadius: '50%',
              background: `${color}15`, color: color,
              fontSize: '0.7rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main Panel ──────────────────────────────────────────────── */
export default function AiFunctionsPanel({ data, onResult }) {
  const [activeTab, setActiveTab] = useState('generate');
  const [prompt, setPrompt]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [outputCol, setOutputCol] = useState('ai_insight');
  const [suggestions, setSuggestions] = useState([]);

  const tab   = TABS.find(t => t.id === activeTab);
  const limit = LIMITS[activeTab];

  // Regenerate suggestions when tab or data changes
  useEffect(() => {
    setSuggestions(buildSuggestions(data, activeTab));
  }, [activeTab, data]);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const rows = (data || []).slice(0, limit);

    try {
      let res;
      if (activeTab === 'generate') {
        res = await api.post('/ai/generate', { rows, prompt, output_column: outputCol });
      } else if (activeTab === 'if') {
        res = await api.post('/ai/if', { rows, condition: prompt });
      } else {
        res = await api.post('/ai/rank', { rows, criteria: prompt });
      }
      setResult(res.data);
      if (onResult) onResult(res.data.rows);
    } catch (e) {
      setError(e.response?.data?.detail || 'AI function failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setPrompt('');
    if (onResult) onResult(null);
  };

  const switchTab = (id) => {
    setActiveTab(id);
    setResult(null);
    setError(null);
    setPrompt('');
    if (onResult) onResult(null);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={15} color="#7c3aed" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
          AlloyDB AI Functions
        </span>
        <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: 'auto' }}>
          Inspired by AlloyDB ai.generate / ai.if / ai.rank
        </span>
      </div>

      {/* Function selector tabs */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '6px', border: '1.5px solid',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
              borderColor: activeTab === t.id ? t.color : '#e5e7eb',
              background:  activeTab === t.id ? t.color + '15' : 'white',
              color:       activeTab === t.id ? t.color : '#6b7280',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f9fafb',
        border: '1px solid #f3f4f6', borderRadius: '6px', padding: '8px 12px' }}>
        {tab.desc}
        {data?.length > limit && (
          <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
            ⚠ Only first {limit} rows will be processed
          </span>
        )}
      </div>

      {/* Suggestions — only show when no result yet */}
      {!result && !loading && (
        <SuggestionPills
          suggestions={suggestions}
          color={tab.color}
          onSelect={(s) => setPrompt(s)}
        />
      )}

      {/* Output column name — only for ai.generate */}
      {activeTab === 'generate' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.78rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Output column name:
          </label>
          <input value={outputCol} onChange={e => setOutputCol(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem',
              border: '1px solid #d1d5db', borderRadius: '6px',
              outline: 'none', fontFamily: 'monospace' }}
            placeholder="ai_insight" />
        </div>
      )}

      {/* Prompt + Run */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && run()}
          placeholder={PLACEHOLDERS[activeTab]}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem',
            border: `1.5px solid ${tab.color}40`, borderRadius: '8px',
            outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={run}
          disabled={loading || !prompt.trim() || !data?.length}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: loading || !prompt.trim() ? '#e5e7eb' : tab.color,
            color:      loading || !prompt.trim() ? '#9ca3af' : 'white',
            fontWeight: 600, fontSize: '0.82rem',
            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
          }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : tab.icon}
          {loading ? 'Running...' : 'Run'}
        </button>
        {result && (
          <button onClick={reset} title="Reset"
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e5e7eb',
              background: 'white', cursor: 'pointer', color: '#6b7280' }}>
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '8px',
          fontSize: '0.82rem', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem' }}>
          <div style={{ marginBottom: '8px' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          Gemini is processing {(data || []).slice(0, limit).length} rows...
        </div>
      )}

      {/* Result summary + inline table */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Summary */}
          <div style={{
            padding: '10px 14px', borderRadius: '8px',
            border: `1.5px solid ${tab.color}40`,
            background: tab.color + '08',
            fontSize: '0.82rem', color: '#374151',
            display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
          }}>
            {activeTab === 'generate' && (
              <>
                <span>✓ <strong>{result.total}</strong> rows enriched</span>
                <span>New column:
                  <code style={{ background: '#f3f4f6', padding: '1px 6px', marginLeft: '4px',
                    borderRadius: '3px', fontSize: '0.78rem', color: '#7c3aed' }}>
                    {result.output_column}
                  </code>
                </span>
              </>
            )}
            {activeTab === 'if' && (
              <>
                <span>✓ <strong>{result.matched}</strong> rows matched</span>
                <span style={{ color: '#9ca3af' }}>
                  {result.filtered_out} filtered out of {result.total_checked}
                </span>
              </>
            )}
            {activeTab === 'rank' && (
              <>
                <span>✓ <strong>{result.total}</strong> rows reranked</span>
                <span style={{ color: '#9ca3af' }}>by: "{result.criteria}"</span>
              </>
            )}
          </div>

          {/* Inline table */}
          <ResultTable
            rows={result.rows}
            highlightCol={activeTab === 'generate' ? result.output_column : null}
          />

        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}