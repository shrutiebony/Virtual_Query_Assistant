import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  Treemap, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Tabs, Badge, EmptyState } from '../ui';
import { Table2, BarChart2, Brain, Code2, ChevronDown, ChevronUp, Sparkles, Layers, GitBranch } from 'lucide-react';
import './ResultsPanel.css';
import { genuiAPI } from '../../services/api';
import AiFunctionsPanel from './AiFunctionsPanel';

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6','#ef4444','#f97316','#06b6d4'];

/* ── Helpers ─────────────────────────────────────────────────── */
function safeStr(v) { return v == null ? '' : String(v); }

function normalizeTopValues(tv) {
  if (!tv) return [];
  if (Array.isArray(tv)) {
    return tv.map(item =>
      Array.isArray(item) ? [safeStr(item[0]), safeStr(item[1])] :
      typeof item === 'object' ? [safeStr(item.value ?? item.val ?? item.name ?? ''), safeStr(item.count ?? item.cnt ?? '')] :
      [safeStr(item), '']
    );
  }
  if (typeof tv === 'object') return Object.entries(tv).map(([k,v]) => [safeStr(k), safeStr(v)]);
  return [];
}

function normalizeCols(profile) {
  if (!profile) return [];
  const raw = profile.columns ?? profile.column_profiles ?? profile.col_profiles ?? [];
  if (Array.isArray(raw)) {
    return raw.map(c => ({
      ...c,
      name: c.name ?? c.col ?? c.column ?? 'unknown',
      type: c.type === 'numeric' ? 'numeric' : 'categorical',
      top_values: c.top_values ?? c.top_counts ?? [],
    }));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([name, stats]) => ({
      name, ...stats,
      type: stats.type === 'numeric' ? 'numeric' : 'categorical',
    }));
  }
  return [];
}

/* ── DataTable ────────────────────────────────────────────────── */
function DataTable({ data, columns }) {
  if (!data?.length) return <EmptyState icon={<Table2 size={22}/>} title="No data returned" />;
  const cols = columns?.length ? columns : Object.keys(data[0]);
  return (
    <div className="data-table-wrap">
      <div className="data-table-meta">{data.length} row{data.length !== 1 ? 's' : ''} / {cols.length} col{cols.length !== 1 ? 's' : ''}</div>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c}>
                    <span className={typeof row[c] === 'number' ? 'cell-num' : ''}>
                      {row[c] == null ? <span className="cell-null">null</span>
                        : typeof row[c] === 'object' ? JSON.stringify(row[c])
                        : String(row[c])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── ChartPanel (Collage View) ───────────────────────────────── */
function ChartPanel({ data, viz }) {
  const allCols  = data?.length ? Object.keys(data[0]) : [];
  const numCols  = allCols.filter(k => data[0] && typeof data[0][k] === 'number');
  const textCols = allCols.filter(k => data[0] && typeof data[0][k] !== 'number');

  const [xCol, setXCol]       = useState(viz?.x_col || textCols[0] || allCols[0] || '');
  const [yCols, setYCols]     = useState(viz?.y_cols || numCols.slice(0, 2) || []);
  const [focused, setFocused] = useState(null);
  const [animate, setAnimate] = useState(true);

  const colKey = allCols.join(',');
  React.useEffect(() => {
    setXCol(viz?.x_col || textCols[0] || allCols[0] || '');
    setYCols(viz?.y_cols || numCols.slice(0, 2) || []);
    setAnimate(true);
    setTimeout(() => setAnimate(false), 1000);
  }, [colKey]); // eslint-disable-line

  if (!data?.length) return <EmptyState icon={<BarChart2 size={22}/>} title="No chart available" />;

  const activeY = yCols.length ? yCols : numCols.slice(0, 1);

  const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#14b8a6','#a855f7','#ef4444','#f97316','#06b6d4'];
  const CARD_STYLES  = [
    { border:'#6366f130', bg:'#6366f108', accent:'#6366f1' },
    { border:'#22c55e30', bg:'#22c55e08', accent:'#22c55e' },
    { border:'#f59e0b30', bg:'#f59e0b08', accent:'#f59e0b' },
    { border:'#14b8a630', bg:'#14b8a608', accent:'#14b8a6' },
  ];

  const downloadChart = (chartId) => {
    const container = document.getElementById(`chart-container-${chartId}`);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas  = document.createElement('canvas');
    const ctx     = canvas.getContext('2d');
    const img     = new Image();
    canvas.width  = svg.clientWidth  || 600;
    canvas.height = svg.clientHeight || 300;
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `chart-${chartId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const renderBar = () => (
    <BarChart data={data} margin={{top:10,right:10,left:0,bottom:5}}>
      <defs>
        {activeY.map((k,i) => (
          <linearGradient key={k} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART_COLORS[i]} stopOpacity={0.9}/>
            <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0.5}/>
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f7" vertical={false}/>
      <XAxis dataKey={xCol} tick={{fontSize:10,fill:'#6b7591'}} axisLine={{stroke:'#e5e7eb'}} tickLine={false}/>
      <YAxis tick={{fontSize:10,fill:'#6b7591'}} axisLine={false} tickLine={false} tickFormatter={v=>Number(v).toLocaleString()}/>
      <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e5e7eb',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}} formatter={v=>[Number(v).toLocaleString()]}/>
      <Legend wrapperStyle={{fontSize:11}}/>
      {activeY.map((k,i) => <Bar key={k} dataKey={k} fill={`url(#barGrad${i})`} radius={[6,6,0,0]} maxBarSize={52} isAnimationActive={animate}/>)}
    </BarChart>
  );

  const renderLine = () => (
    <LineChart data={data} margin={{top:10,right:10,left:0,bottom:5}}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f7"/>
      <XAxis dataKey={xCol} tick={{fontSize:10,fill:'#6b7591'}} axisLine={{stroke:'#e5e7eb'}} tickLine={false}/>
      <YAxis tick={{fontSize:10,fill:'#6b7591'}} axisLine={false} tickLine={false} tickFormatter={v=>Number(v).toLocaleString()}/>
      <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e5e7eb',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}} formatter={v=>[Number(v).toLocaleString()]}/>
      <Legend wrapperStyle={{fontSize:11}}/>
      {activeY.map((k,i) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i]} strokeWidth={2.5} dot={{r:3,fill:CHART_COLORS[i]}} activeDot={{r:5}} isAnimationActive={animate}/>)}
    </LineChart>
  );

  const renderPie = () => (
    <PieChart margin={{top:10,right:10,left:10,bottom:5}}>
      <Pie data={data} dataKey={activeY[0]||numCols[0]} nameKey={xCol}
        cx="50%" cy="45%" outerRadius={85} innerRadius={30}
        paddingAngle={3} isAnimationActive={animate}
        label={({name,percent}) => percent>0.05?`${(percent*100).toFixed(0)}%`:''} labelLine={false}>
        {data.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} stroke="white" strokeWidth={2}/>)}
      </Pie>
      <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e5e7eb',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}} formatter={v=>[Number(v).toLocaleString()]}/>
      <Legend wrapperStyle={{fontSize:11}}/>
    </PieChart>
  );

  const renderTreemap = () => {
    const treemapData = data.map((row,i) => ({
      name: String(row[xCol] ?? `Row ${i+1}`),
      size: Math.abs(Number(row[activeY[0]])||1),
      fill: CHART_COLORS[i%CHART_COLORS.length],
    }));

    const TreeContent = (props) => {
      const { x, y, width, height, name, size, fill } = props || {};
      if (x==null||y==null||!width||!height||width<10||height<10) return null;
      const safeName = name!=null ? String(name) : '';
      const safeSize = size!=null ? Number(size) : 0;
      return (
        <g>
          <rect x={x+1} y={y+1} width={width-2} height={height-2} rx={6} ry={6}
            fill={fill||'#6366f1'} fillOpacity={0.85} stroke="#fff" strokeWidth={2}/>
          {width>50 && height>30 && (
            <>
              <text x={x+width/2} y={y+height/2-6} textAnchor="middle" fill="#fff"
                fontSize={Math.min(12,width/6)} fontWeight={700}>
                {safeName.length>12 ? safeName.slice(0,12)+'…' : safeName}
              </text>
              <text x={x+width/2} y={y+height/2+10} textAnchor="middle"
                fill="rgba(255,255,255,0.85)" fontSize={Math.min(10,width/8)}>
                {safeSize.toLocaleString()}
              </text>
            </>
          )}
        </g>
      );
    };

    return (
      <Treemap data={treemapData} dataKey="size" aspectRatio={4/3}
        isAnimationActive={animate} content={TreeContent}/>
    );
  };

  const renderStats = () => {
    const stats = numCols.slice(0,4).map((col,i) => {
      const vals  = data.map(r=>Number(r[col])).filter(v=>!isNaN(v));
      const total = vals.reduce((a,b)=>a+b,0);
      const avg   = vals.length ? total/vals.length : 0;
      return {
        col, color:CHART_COLORS[i],
        bg:CARD_STYLES[i%CARD_STYLES.length].bg,
        border:CARD_STYLES[i%CARD_STYLES.length].border,
        total, avg,
        max:vals.length?Math.max(...vals):0,
        min:vals.length?Math.min(...vals):0,
      };
    });
    if (!stats.length) return <div style={{padding:24,textAlign:'center',color:'#9ca3af',fontSize:13}}>No numeric columns to summarize</div>;
    return (
      <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(stats.length,4)},1fr)`,gap:12,padding:16}}>
        {stats.map(s => (
          <div key={s.col} style={{background:s.bg,border:`1.5px solid ${s.border}`,borderRadius:12,padding:16,transition:'transform 0.2s,box-shadow 0.2s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
            <div style={{fontSize:10,color:s.color,fontWeight:700,marginBottom:12,textTransform:'uppercase',letterSpacing:'0.08em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.col}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[{label:'Total',value:s.total,icon:'Σ'},{label:'Avg',value:s.avg,icon:'∅'},{label:'Max',value:s.max,icon:'↑'},{label:'Min',value:s.min,icon:'↓'}].map(({label,value,icon}) => (
                <div key={label} style={{background:'rgba(255,255,255,0.7)',borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:10,color:'#9ca3af',marginBottom:2}}>{icon} {label}</div>
                  <div style={{fontSize:15,fontWeight:700,color:s.color}}>{Number(value).toLocaleString(undefined,{maximumFractionDigits:1})}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const charts = [
    { id:'bar',     label:'Bar Chart',  icon:'▊', render:renderBar     },
    { id:'line',    label:'Line Chart', icon:'∿', render:renderLine    },
    { id:'pie',     label:'Pie Chart',  icon:'◔', render:renderPie     },
    { id:'treemap', label:'Treemap',    icon:'⊞', render:renderTreemap },
  ];

  return (
    <div className="chart-panel">
      <div className="chart-controls" style={{marginBottom:16,padding:'10px 14px',background:'#f9fafb',borderRadius:10,border:'1px solid #f3f4f6'}}>
        <div className="chart-control-group">
          <label className="chart-ctrl-label">X Axis</label>
          <select className="chart-select" value={xCol} onChange={e=>setXCol(e.target.value)}>
            {allCols.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {numCols.length>0 && (
          <div className="chart-control-group">
            <label className="chart-ctrl-label">Y Columns</label>
            <div className="chart-y-checks">
              {numCols.map(c=>(
                <label key={c} className="chart-y-check">
                  <input type="checkbox" checked={yCols.includes(c)}
                    onChange={()=>setYCols(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])}/>
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {focused && (
          <button className="chart-type-btn active" style={{marginLeft:'auto'}} onClick={()=>setFocused(null)}>
            ⊞ Show All Charts
          </button>
        )}
      </div>

      {focused ? (
        <div style={{background:'#fff',borderRadius:12,border:'1.5px solid #e5e7eb',boxShadow:'0 4px 16px rgba(0,0,0,0.06)',padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:14,fontWeight:700,color:'#111827'}}>
              {charts.find(c=>c.id===focused)?.icon}{' '}{charts.find(c=>c.id===focused)?.label}
            </span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>downloadChart(focused)} style={{fontSize:11,color:'#6b7280',background:'#f3f4f6',border:'none',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontWeight:600}}>⬇ Download PNG</button>
              <button onClick={()=>setFocused(null)} style={{fontSize:11,color:'#6366f1',background:'#eef2ff',border:'none',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontWeight:600}}>← Back to collage</button>
            </div>
          </div>
          <div id={`chart-container-${focused}`}>
            <ResponsiveContainer width="100%" height={420}>
              {charts.find(c=>c.id===focused)?.render()}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {charts.map((chart,idx) => (
              <div key={chart.id} id={`chart-container-${chart.id}`}
                style={{background:'#fff',borderRadius:12,border:`1.5px solid ${CARD_STYLES[idx].border}`,boxShadow:'0 2px 8px rgba(0,0,0,0.04)',padding:'14px 14px 10px',display:'flex',flexDirection:'column',gap:10,transition:'box-shadow 0.2s,transform 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';e.currentTarget.style.transform='translateY(0)';}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:16,color:CARD_STYLES[idx].accent}}>{chart.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>{chart.label}</span>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>downloadChart(chart.id)} style={{fontSize:10,color:'#9ca3af',background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:5,padding:'3px 8px',cursor:'pointer'}}>⬇</button>
                    <button onClick={()=>setFocused(chart.id)} style={{fontSize:10,color:CARD_STYLES[idx].accent,background:`${CARD_STYLES[idx].border}`,border:'none',borderRadius:5,padding:'3px 8px',cursor:'pointer',fontWeight:700}}>Focus ⤢</button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  {chart.render()}
                </ResponsiveContainer>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,background:'#fff',borderRadius:12,border:'1.5px solid #e5e7eb',boxShadow:'0 2px 8px rgba(0,0,0,0.04)',overflow:'hidden'}}>
            <div style={{padding:'12px 20px',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>📊 Summary Statistics</span>
              <span style={{fontSize:11,color:'#9ca3af'}}>{data.length} rows · {numCols.length} numeric column{numCols.length!==1?'s':''}</span>
            </div>
            {renderStats()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── EdaPanel (Dashboard Style) ─────────────────────────────── */
function EdaPanel({ profile, edaInsights, data, question }) {
  const eda  = edaInsights || {};
  const cols = normalizeCols(profile);

  const COL_COLORS = ['#6366f1','#22c55e','#f59e0b','#14b8a6','#a855f7','#ef4444','#f97316','#06b6d4'];

  const qualityColor = (score) => {
    if (score>=80) return {color:'#16a34a',bg:'#f0fdf4',border:'#86efac'};
    if (score>=60) return {color:'#d97706',bg:'#fffbeb',border:'#fcd34d'};
    return {color:'#dc2626',bg:'#fef2f2',border:'#fca5a5'};
  };

  const MiniBar = ({value,max,color}) => (
    <div style={{width:'100%',height:4,background:'#f3f4f6',borderRadius:2}}>
      <div style={{width:`${max>0?Math.min((value/max)*100,100):0}%`,height:'100%',background:color,borderRadius:2,transition:'width 0.8s ease'}}/>
    </div>
  );

  const MiniDistribution = ({col,color}) => {
    if (!data?.length) return null;
    const values = data.map(r=>r[col.name]).filter(v=>v!=null);
    const isNum  = col.type==='numeric';
    if (isNum) {
      const nums = values.map(Number).filter(v=>!isNaN(v));
      if (!nums.length) return null;
      const min=Math.min(...nums),max=Math.max(...nums),range=max-min||1,bins=8;
      const counts=Array(bins).fill(0);
      nums.forEach(v=>{const i=Math.min(Math.floor(((v-min)/range)*bins),bins-1);counts[i]++;});
      const maxC=Math.max(...counts);
      return (
        <div style={{display:'flex',alignItems:'flex-end',gap:2,height:28,marginTop:8}}>
          {counts.map((c,i)=>(
            <div key={i} style={{flex:1,background:color,opacity:0.2+(c/maxC)*0.8,height:`${maxC>0?(c/maxC)*100:0}%`,borderRadius:'2px 2px 0 0',minHeight:c>0?2:0,transition:'height 0.6s ease'}}/>
          ))}
        </div>
      );
    }
    const counts={};
    values.forEach(v=>{counts[String(v)]=(counts[String(v)]||0)+1;});
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const maxC=top[0]?.[1]||1;
    return (
      <div style={{display:'flex',flexDirection:'column',gap:3,marginTop:8}}>
        {top.map(([val,cnt])=>(
          <div key={val} style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:9,color:'#6b7591',minWidth:55,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{val}</span>
            <div style={{flex:1,height:4,background:'#f3f4f6',borderRadius:2}}>
              <div style={{width:`${(cnt/maxC)*100}%`,height:'100%',background:color,borderRadius:2}}/>
            </div>
            <span style={{fontSize:9,color:'#9ca3af',minWidth:14}}>{cnt}</span>
          </div>
        ))}
      </div>
    );
  };

  const rowCount    = profile?.total_rows ?? data?.length ?? 0;
  const colCount    = profile?.total_cols ?? cols.length;
  const nullCols    = cols.filter(c=>(c.null_pct||0)>0).length;
  const numericCols = cols.filter(c=>c.type==='numeric').length;
  const qScore      = eda?.data_quality?.score ?? null;
  const qColors     = qScore!==null ? qualityColor(qScore) : null;

  if (cols.length===0 && !eda.headline) {
    return <div style={{padding:40,textAlign:'center',color:'#9ca3af',fontSize:13}}>No EDA profile available for this result.</div>;
  }

  return (
    <div style={{padding:'4px 0',display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          {label:'Total Rows',      value:rowCount,    icon:'⊞',color:'#6366f1',bg:'#eef2ff'},
          {label:'Columns',         value:colCount,    icon:'≡', color:'#0891b2',bg:'#ecfeff'},
          {label:'Numeric Columns', value:numericCols, icon:'#', color:'#16a34a',bg:'#f0fdf4'},
          {label:'Cols with Nulls', value:nullCols,    icon:'∅',
            color:nullCols>0?'#d97706':'#16a34a', bg:nullCols>0?'#fffbeb':'#f0fdf4'},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'14px 16px',border:`1.5px solid ${s.color}25`,transition:'transform 0.2s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:28,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:10,color:'#6b7591',marginTop:4,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>

      {(eda.headline||qScore!==null) && (
        <div style={{display:'grid',gridTemplateColumns:qScore!==null?'1fr auto':'1fr',gap:12}}>
          {eda.headline && (
            <div style={{background:'linear-gradient(135deg,#eef2ff,#f5f3ff)',border:'1.5px solid #e0e7ff',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'#6366f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>💡</div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#6366f1',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Key Insight</div>
                <div style={{fontSize:13,color:'#374151',lineHeight:1.7,fontWeight:500}}>{safeStr(eda.headline)}</div>
              </div>
            </div>
          )}
          {qScore!==null && qColors && (
            <div style={{background:qColors.bg,border:`1.5px solid ${qColors.border}`,borderRadius:12,padding:'16px 24px',textAlign:'center',minWidth:130}}>
              <div style={{fontSize:10,fontWeight:700,color:qColors.color,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Data Quality</div>
              <div style={{fontSize:42,fontWeight:800,color:qColors.color,lineHeight:1}}>{qScore}</div>
              <div style={{fontSize:11,color:qColors.color,marginTop:4}}>/100</div>
              <div style={{marginTop:10,fontSize:11,fontWeight:600,color:qColors.color,background:`${qColors.border}60`,borderRadius:8,padding:'4px 10px'}}>{eda.data_quality?.verdict||''}</div>
              {Array.isArray(eda.data_quality?.issues) && eda.data_quality.issues.map((iss,i)=>(
                <div key={i} style={{fontSize:10,color:'#d97706',background:'#fffbeb',borderRadius:6,padding:'3px 8px',marginTop:4}}>⚠ {safeStr(iss)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {Array.isArray(eda.key_findings) && eda.key_findings.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:'#fff',border:'1.5px solid #e5e7eb',borderRadius:12,padding:'16px 18px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <div style={{width:28,height:28,borderRadius:8,background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>📋</div>
              <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>Key Findings</span>
            </div>
            {eda.key_findings.map((f,i)=>(
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:12,paddingBottom:12,borderBottom:i<eda.key_findings.length-1?'1px solid #f3f4f6':'none'}}>
                <span style={{minWidth:22,height:22,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',borderRadius:6,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{i+1}</span>
                <span style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{safeStr(f)}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {Array.isArray(eda.recommendations) && eda.recommendations.length>0 && (
              <div style={{background:'#fff',border:'1.5px solid #e5e7eb',borderRadius:12,padding:'16px 18px',flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <div style={{width:28,height:28,borderRadius:8,background:'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✨</div>
                  <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>Recommendations</span>
                </div>
                {eda.recommendations.map((r,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                    <span style={{width:20,height:20,borderRadius:'50%',background:'#f0fdf4',border:'1.5px solid #86efac',color:'#16a34a',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>→</span>
                    <span style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{safeStr(r)}</span>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(eda.interesting_facts) && eda.interesting_facts.length>0 && (
              <div style={{background:'linear-gradient(135deg,#f0fdf4,#ecfeff)',border:'1.5px solid #86efac',borderRadius:12,padding:'16px 18px',flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <div style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,0.8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🔍</div>
                  <span style={{fontSize:11,fontWeight:700,color:'#16a34a',textTransform:'uppercase',letterSpacing:'0.06em'}}>Interesting Facts</span>
                </div>
                {eda.interesting_facts.map((f,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                    <span style={{fontSize:14,color:'#16a34a',flexShrink:0,marginTop:1}}>★</span>
                    <span style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{safeStr(f)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {Array.isArray(eda.column_insights) && eda.column_insights.length>0 && (
        <div style={{background:'#fff',border:'1.5px solid #e5e7eb',borderRadius:12,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <div style={{width:28,height:28,borderRadius:8,background:'#ecfeff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🔬</div>
            <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>Column Insights</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
            {eda.column_insights.map((ci,i)=>(
              <div key={i} style={{background:`${COL_COLORS[i%COL_COLORS.length]}08`,border:`1.5px solid ${COL_COLORS[i%COL_COLORS.length]}25`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:11,fontWeight:700,color:COL_COLORS[i%COL_COLORS.length],marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:18,height:18,borderRadius:4,background:COL_COLORS[i%COL_COLORS.length],color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>#</span>
                  {safeStr(ci.col)}
                </div>
                <div style={{fontSize:12,color:'#374151',lineHeight:1.6}}>{safeStr(ci.insight)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cols.length>0 && (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>📊</div>
            <span style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em'}}>Column Profiles</span>
            <span style={{fontSize:11,color:'#9ca3af',marginLeft:4}}>{cols.length} column{cols.length!==1?'s':''}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12}}>
            {cols.map((col,idx)=>{
              const color   = COL_COLORS[idx%COL_COLORS.length];
              const colType = col.type??(col.mean!==undefined?'numeric':'categorical');
              const nullPct = col.null_pct||0;
              const topVals = normalizeTopValues(col.top_values??col.top_counts);
              const isNum   = colType==='numeric';
              return (
                <div key={col.name??idx} style={{background:'#fff',border:`1.5px solid ${color}25`,borderRadius:12,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',transition:'transform 0.2s,box-shadow 0.2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=`0 8px 20px ${color}20`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:130}}>{col.name??`col_${idx}`}</div>
                      <div style={{fontSize:10,color:color,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:3}}>{colType}</div>
                    </div>
                    <div style={{width:32,height:32,borderRadius:8,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:color,fontWeight:700}}>{isNum?'#':'A'}</div>
                  </div>
                  {isNum && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
                      {[{label:'Min',value:col.min},{label:'Max',value:col.max},{label:'Mean',value:col.mean!=null?Number(col.mean).toFixed(2):'--'},{label:'Nulls',value:`${Number(nullPct).toFixed(1)}%`}].map(({label,value})=>(
                        <div key={label} style={{background:`${color}08`,borderRadius:8,padding:'6px 10px'}}>
                          <div style={{fontSize:9,color:'#9ca3af',marginBottom:2}}>{label}</div>
                          <div style={{fontSize:14,fontWeight:700,color:color}}>{value??'--'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isNum && topVals.length>0 && (
                    <div style={{marginBottom:8}}>
                      {topVals.slice(0,3).map(([v,c],i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{fontSize:11,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:120}}>{v}</span>
                          <span style={{fontSize:10,color:'#fff',background:color,borderRadius:10,padding:'2px 8px',fontWeight:600,flexShrink:0}}>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <MiniDistribution col={col} color={color}/>
                  {nullPct>0 && (
                    <div style={{marginTop:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#9ca3af',marginBottom:4}}>
                        <span>Null values</span>
                        <span style={{color:nullPct>20?'#dc2626':'#d97706',fontWeight:600}}>{Number(nullPct).toFixed(1)}%</span>
                      </div>
                      <MiniBar value={nullPct} max={100} color={nullPct>20?'#ef4444':'#f59e0b'}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ReActPanel ──────────────────────────────────────────────── */
function ReActPanel({ trace }) {
  if (!trace) return null;
  const { attempts, self_corrected, thoughts, actions, observations } = trace;
  const STEP_COLORS = ['#6366f1','#22c55e','#f59e0b'];
  const statusColor  = self_corrected ? '#d97706' : '#16a34a';
  const statusBg     = self_corrected ? '#fffbeb' : '#f0fdf4';
  const statusBorder = self_corrected ? '#fcd34d' : '#86efac';
  const statusText   = self_corrected
    ? `⚠ Self-corrected after ${attempts} attempt${attempts!==1?'s':''}`
    : `✓ Succeeded on first attempt`;

  return (
    <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:16}}>

      {/* Status header */}
      <div style={{background:statusBg,border:`1.5px solid ${statusBorder}`,borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:statusColor,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
          {self_corrected ? '🔄' : '✓'}
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:statusColor}}>{statusText}</div>
          <div style={{fontSize:11,color:'#6b7280',marginTop:3}}>ReAct loop: Reasoning + Acting + Observing</div>
        </div>
        <div style={{marginLeft:'auto',textAlign:'center',background:'#fff',borderRadius:10,padding:'8px 16px',border:`1px solid ${statusBorder}`}}>
          <div style={{fontSize:24,fontWeight:800,color:statusColor}}>{attempts}</div>
          <div style={{fontSize:10,color:'#6b7280'}}>attempt{attempts!==1?'s':''}</div>
        </div>
      </div>

      {/* Step-by-step trace */}
      {Array.from({length:attempts}).map((_,i) => {
        const color   = STEP_COLORS[i%STEP_COLORS.length];
        const thought = thoughts?.[i] || '';
        const action  = actions?.[i]  || '';
        const observe = observations?.[i] || '';
        const isSuccess = observe.toLowerCase().includes('success');
        const isFailed  = observe.toLowerCase().includes('fail') ||
                          observe.toLowerCase().includes('error') ||
                          observe.toLowerCase().includes('blocked');
        return (
          <div key={i} style={{background:'#fff',border:`1.5px solid ${color}25`,borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            {/* Attempt header */}
            <div style={{background:`${color}12`,borderBottom:`1px solid ${color}25`,padding:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:color,color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{i+1}</div>
              <span style={{fontSize:12,fontWeight:700,color}}>Attempt {i+1}</span>
              <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:isSuccess?'#16a34a':isFailed?'#dc2626':'#6b7280',background:isSuccess?'#f0fdf4':isFailed?'#fef2f2':'#f3f4f6',border:`1px solid ${isSuccess?'#86efac':isFailed?'#fca5a5':'#e5e7eb'}`,borderRadius:6,padding:'2px 8px'}}>
                {isSuccess ? '✓ Success' : isFailed ? '✗ Failed' : '↻ Retrying'}
              </span>
            </div>

            {/* Think */}
            {thought && (
              <div style={{padding:'12px 16px',borderBottom:'1px solid #f3f4f6'}}>
                <div style={{fontSize:10,fontWeight:700,color:'#6366f1',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>🧠 Think</div>
                <div style={{fontSize:12,color:'#374151',lineHeight:1.6,background:'#eef2ff',borderRadius:8,padding:'8px 12px'}}>{thought}</div>
              </div>
            )}

            {/* Act */}
            {action && (
              <div style={{padding:'12px 16px',borderBottom:'1px solid #f3f4f6'}}>
                <div style={{fontSize:10,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>⚡ Act</div>
                <pre style={{fontSize:11,color:'#1e1b4b',lineHeight:1.6,background:'#f8fafc',borderRadius:8,padding:'8px 12px',overflowX:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,fontFamily:'monospace',border:'1px solid #e2e8f0'}}>{action}</pre>
              </div>
            )}

            {/* Observe */}
            {observe && (
              <div style={{padding:'12px 16px'}}>
                <div style={{fontSize:10,fontWeight:700,color:isSuccess?'#16a34a':'#dc2626',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>👁 Observe</div>
                <div style={{fontSize:12,color:'#374151',lineHeight:1.6,background:isSuccess?'#f0fdf4':'#fef2f2',borderRadius:8,padding:'8px 12px',border:`1px solid ${isSuccess?'#86efac':'#fca5a5'}`}}>{observe}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{display:'flex',gap:16,flexWrap:'wrap',padding:'10px 14px',background:'#f9fafb',borderRadius:10,border:'1px solid #f3f4f6'}}>
        {[
          {icon:'🧠',label:'Think',desc:'Agent reasons about the question'},
          {icon:'⚡',label:'Act',  desc:'Agent generates and runs SQL'},
          {icon:'👁',label:'Observe',desc:'Agent evaluates the result'},
        ].map(({icon,label,desc}) => (
          <div key={label} style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:14}}>{icon}</span>
            <div>
              <span style={{fontSize:11,fontWeight:700,color:'#374151'}}>{label}</span>
              <span style={{fontSize:11,color:'#9ca3af',marginLeft:4}}>— {desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── GenUIPanel ───────────────────────────────────────────────── */
function GenUIPanel({ result, question }) {
  const [html, setHtml]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const rows    = result.data    || [];
      const columns = result.columns || Object.keys(rows[0]||{});
      const res = await genuiAPI.generate({ question, columns, rows });
      setHtml(res.data.html);
    } catch (e) {
      setError(e.response?.data?.detail||'Failed to generate UI');
    } finally { setLoading(false); }
  };

  if (!html&&!loading) return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <p style={{color:'var(--gray-500)',marginBottom:'16px',fontSize:'0.9rem'}}>Gemini will generate an interactive visualization app from your data.</p>
      <button onClick={generate} className="sql-toggle" style={{margin:'0 auto'}}><Layers size={14}/> Generate Live UI</button>
    </div>
  );
  if (loading) return (
    <div style={{padding:'60px',textAlign:'center',color:'var(--gray-400)'}}>
      <div style={{fontSize:'1.5rem',marginBottom:'12px'}}>⚙️</div>
      <div style={{fontWeight:600,marginBottom:'8px',color:'var(--gray-600)',fontSize:'0.95rem'}}>Generating interactive UI...</div>
      <div style={{fontSize:'0.82rem',color:'var(--gray-400)'}}>Gemini is building a custom app for your data.<br/>This takes 10–20 seconds.</div>
    </div>
  );
  if (error) return <div style={{padding:'24px',color:'red',fontSize:'0.85rem'}}>{error}</div>;
  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'8px'}}>
        <button onClick={generate} className="sql-toggle">↻ Regenerate</button>
      </div>
      <iframe srcDoc={html} style={{width:'100%',height:'600px',border:'none',borderRadius:'8px'}} sandbox="allow-scripts" title="Generative UI"/>
    </div>
  );
}

/* ── ResultsPanel (main export) ───────────────────────────────── */
export default function ResultsPanel({ result, sql, question }) {
  const [tab, setTab]         = useState('table');
  const [showSql, setShowSql] = useState(false);
  const [aiRows, setAiRows]   = useState(null);

  if (!result) return null;

  const data    = result.data || [];
  const columns = aiRows ? Object.keys(aiRows[0]||{}) : (result.columns||[]);
  const hasReact = !!result.react_trace;

  const tabs = [
    { id:'table',  label:'Table',        icon:<Table2 size={14}/>    },
    { id:'chart',  label:'Charts',       icon:<BarChart2 size={14}/> },
    { id:'eda',    label:'EDA Profile',  icon:<Brain size={14}/>     },
    { id:'liveui', label:'Live UI',      icon:<Layers size={14}/>    },
    { id:'ai',     label:'AI Functions', icon:<Sparkles size={14}/>  },
    ...(hasReact ? [{ id:'react', label:'ReAct Trace', icon:<GitBranch size={14}/> }] : []),
  ];

  return (
    <div className="results-panel fade-in">
      <div className="results-meta">
        <div className="results-meta-left">
          <Badge color="green">{data.length} rows</Badge>
          {result.execution_time_ms && <Badge color="gray">{result.execution_time_ms}ms</Badge>}
          {Array.isArray(result.tables_used)&&result.tables_used.length>0 && <Badge color="blue">{result.tables_used.join(', ')}</Badge>}
          {result.collection && <Badge color="green">{result.collection}</Badge>}
          {/* ReAct self-correction badge */}
          {result.react_trace && result.react_trace.attempts > 1 && (
            <div
              onClick={() => setTab('react')}
              style={{
                fontSize:11, color:'#d97706', background:'#fffbeb',
                border:'1px solid #fcd34d', borderRadius:6,
                padding:'3px 10px', display:'flex', alignItems:'center',
                gap:4, cursor:'pointer',
              }}
              title="Click to see ReAct trace"
            >
              🔄 {result.react_trace.attempts} attempts — self-corrected
            </div>
          )}
          {/* ReAct success badge for single attempt */}
          {result.react_trace && result.react_trace.attempts === 1 && (
            <div
              onClick={() => setTab('react')}
              style={{
                fontSize:11, color:'#16a34a', background:'#f0fdf4',
                border:'1px solid #86efac', borderRadius:6,
                padding:'3px 10px', display:'flex', alignItems:'center',
                gap:4, cursor:'pointer',
              }}
              title="Click to see ReAct trace"
            >
              ✓ ReAct — 1 attempt
            </div>
          )}
        </div>
        {(sql||result.sql) && (
          <button className="sql-toggle" onClick={()=>setShowSql(s=>!s)}>
            <Code2 size={14}/> SQL {showSql?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
          </button>
        )}
      </div>

      {showSql&&(sql||result.sql) && (
        <div className="sql-drawer"><pre className="sql-code">{sql||result.sql}</pre></div>
      )}

      {result.summary && <div className="results-summary">{safeStr(result.summary)}</div>}

      <Tabs tabs={tabs} active={tab} onChange={setTab}/>

      <div className="results-body">
        {tab==='table'  && <DataTable data={aiRows||data} columns={columns}/>}
        {tab==='chart'  && <ChartPanel data={data} viz={result.viz}/>}
        {tab==='eda'    && <EdaPanel profile={result.profile} edaInsights={result.eda_insights} data={data} question={question}/>}
        {tab==='liveui' && <GenUIPanel result={result} question={question}/>}
        {tab==='ai'     && <AiFunctionsPanel data={data} onResult={(enriched)=>setAiRows(enriched)}/>}
        {tab==='react'  && <ReActPanel trace={result.react_trace}/>}
      </div>
    </div>
  );
}