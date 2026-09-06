import React from 'react';
import { useAuthStore } from '../store/authStore';
import { Dashboard } from './Dashboard';
import { QADashboard } from './QADashboard';
import { OperatorDashboard } from './OperatorDashboard';
import { FADashboard } from './FADashboard';
import { AdminDashboard } from './AdminDashboard';

export const DashboardRouter: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role || 'reliability_engineer';

  switch (role) {
    case 'qa_manager':
      return <QADashboard />;
    case 'operator':
      return <OperatorDashboard />;
    case 'fa_engineer':
      return <FADashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'reliability_engineer':
    default:
      return <Dashboard />;
  }
};
