// src/pages/student/BusPass.jsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { PassCard } from '../../components/domain/PassCard';

export function StudentBusPass() {
  const { profile } = useAuth();

  return (
    <div className="max-w-md mx-auto">
      <PageHeader
        title="Bus Pass"
        subtitle="Show this digital pass when boarding"
      />
      <PassCard student={profile} showQR={true} />
    </div>
  );
}
