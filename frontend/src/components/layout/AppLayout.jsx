import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Database, Leaf, FolderOpen,
  Link2, LogOut, ChevronRight, Zap, BarChart2, Plug,
} from 'lucide-react';
import './AppLayout.css';

/* MySQL official dolphin logo — simplified SVG, currentColor */
function MySQLIcon({ size = 17, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.9 2.3C16.5 1.5 14.8 1 13 1 8.6 1 5 4.6 5 9c0 2.3.9 4.4 2.4 5.9L6.2 17 5 19h2.5l.6-1.4c1.1.6 2.3.9 3.6.9h.8l-.5 1.5H14l-.5-1.7c1.2-.3 2.3-.9 3.2-1.7L17 19h2.5l-1.1-2-1.2-2.1C18.6 13.5 19.5 11.4 19.5 9c0-2.8-1.2-5.3-3-7 .6-.4 1.1-.5 1.4-.7z"/>
      <path d="M20.5 3.5c-.8.4-1.7 1-2.4 1.8C19.3 6.6 20 7.8 20 9.5c0 .5-.1 1-.2 1.5l1.7 2.5C22.4 12 23 10.6 23 9c0-2.2-1-4.1-2.5-5.5z" opacity=".6"/>
      <circle cx="14.5" cy="7.5" r="1.2"/>
    </svg>
  );
}

const NAV = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/query/postgres', icon: Database,        label: 'PostgreSQL' },
  { to: '/query/mongo',    icon: Leaf,            label: 'MongoDB' },
  { to: '/mysql',          icon: MySQLIcon,       label: 'MySQL' },
  { to: '/datasets',       icon: FolderOpen,      label: 'Datasets' },
  { to: '/connections',    icon: Link2,           label: 'Connections' },
  { to: '/swarm', icon: Zap, label: 'Swarm Agents' },
  { to: '/benchmark', icon: BarChart2, label: 'Benchmark' },
  { to: '/plugin', icon: Plug, label: 'Claude Plugin' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  // initials from displayName
  const initials = (user?.displayName || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-icon"><Zap size={16} /></div>
            {!collapsed && <span className="brand-name">DB Assistant</span>}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
            <ChevronRight size={14} className={collapsed ? '' : 'rotated'} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={17} className="nav-icon" />
              {!collapsed && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" title={user?.email || ''}>
            <div className="user-avatar">{initials}</div>
            {!collapsed && (
              <div className="user-info">
                <span className="user-name">{user?.displayName || user?.email || 'User'}</span>
                <span className="user-email">{user?.email || ''}</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <button className="logout-btn" onClick={handleLogout} title="Sign out">
              <LogOut size={15} />
            </button>
          )}
          {collapsed && (
            <button className="logout-btn logout-btn-solo" onClick={handleLogout} title="Sign out">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}