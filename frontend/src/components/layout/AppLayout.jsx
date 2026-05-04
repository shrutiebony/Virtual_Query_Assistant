import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Database, Leaf, FolderOpen,
  Link2, LogOut, ChevronRight, Zap, BarChart2,
} from 'lucide-react';
import './AppLayout.css';

const NAV = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/query/postgres', icon: Database,        label: 'PostgreSQL' },
  { to: '/query/mongo',    icon: Leaf,            label: 'MongoDB' },
  { to: '/mysql',          icon: Database,        label: 'MySQL' },
  { to: '/datasets',       icon: FolderOpen,      label: 'Datasets' },
  { to: '/connections',    icon: Link2,           label: 'Connections' },
  { to: '/swarm', icon: Zap, label: 'Swarm Agents' },
  { to: '/benchmark', icon: BarChart2, label: 'Benchmark' },
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