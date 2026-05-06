import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SwarmPage from './pages/SwarmPage';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PostgresPage  from './pages/PostgresPage';
import MongoPage     from './pages/MongoPage';
import DatasetsPage  from './pages/DatasetsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import MySQLPage from './pages/MySQLPage';
import AppLayout    from './components/layout/AppLayout';
import BenchmarkDashboard from './pages/BenchmarkDashboard';
import PluginPage from './components/PluginPage';
import HelloWorldPage from './pages/HelloWorldPage';


function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--accent)',
        borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — no login required */}
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          {/* Private routes — login required */}
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index              element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"   element={<DashboardPage />} />
            <Route path="query/postgres" element={<PostgresPage />} />
            <Route path="query/mongo"    element={<MongoPage />} />
            <Route path="datasets"    element={<DatasetsPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
            <Route path="/mysql"      element={<MySQLPage />} />
            <Route path="swarm"       element={<SwarmPage />} />
            <Route path="benchmark"   element={<BenchmarkDashboard />} />
            <Route path="plugin"      element={<PluginPage />} />
            <Route path="hello-world" element={<HelloWorldPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}