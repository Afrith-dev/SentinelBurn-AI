import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateRun } from './pages/CreateRun';
import { RunMonitor } from './pages/RunMonitor';
import { DeviceDeepDive } from './pages/DeviceDeepDive';
import { Reports } from './pages/Reports';
import { ModelPerformance } from './pages/ModelPerformance';
import { Settings } from './pages/Settings';
import { Register } from './pages/Register';

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Landing & Login & Register */}
        <Route path="/" element={<AppShell><Landing /></AppShell>} />
        <Route path="/login" element={<AppShell><Login /></AppShell>} />
        <Route path="/register" element={<AppShell><Register /></AppShell>} />

        {/* Protected Mission Console Routes */}
        <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="/runs" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="/runs/new" element={<AppShell><CreateRun /></AppShell>} />
        <Route path="/runs/:id" element={<AppShell><RunMonitor /></AppShell>} />
        <Route path="/runs/:id/devices/:deviceId" element={<AppShell><DeviceDeepDive /></AppShell>} />
        <Route path="/reports" element={<AppShell><Reports /></AppShell>} />
        <Route path="/models" element={<AppShell><ModelPerformance /></AppShell>} />
        <Route path="/settings" element={<AppShell><Settings /></AppShell>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};
