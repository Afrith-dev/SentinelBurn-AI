import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { FloorLogin } from './pages/FloorLogin';
import { DashboardRouter } from './pages/DashboardRouter';
import { QADashboard } from './pages/QADashboard';
import { FADashboard } from './pages/FADashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { CreateRun } from './pages/CreateRun';
import { RunMonitor } from './pages/RunMonitor';
import { DeviceDeepDive } from './pages/DeviceDeepDive';
import { Reports } from './pages/Reports';
import { ModelPerformance } from './pages/ModelPerformance';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <Router>
      <AppShell>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/floor-login" element={<FloorLogin />} />

          {/* Persona-Routed Aerospace Operations Console */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/runs"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          {/* Direct Role Pages */}
          <Route
            path="/qa"
            element={
              <ProtectedRoute allowedRoles={['qa_manager', 'admin']}>
                <QADashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/fa"
            element={
              <ProtectedRoute allowedRoles={['fa_engineer', 'admin']}>
                <FADashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/runs/new"
            element={
              <ProtectedRoute allowedRoles={['reliability_engineer', 'admin']}>
                <CreateRun />
              </ProtectedRoute>
            }
          />

          <Route
            path="/runs/:id"
            element={
              <ProtectedRoute>
                <RunMonitor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/runs/:id/devices/:deviceId"
            element={
              <ProtectedRoute>
                <DeviceDeepDive />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/models"
            element={
              <ProtectedRoute allowedRoles={['reliability_engineer', 'admin']}>
                <ModelPerformance />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
        </Routes>
      </AppShell>
    </Router>
  );
};

export default App;