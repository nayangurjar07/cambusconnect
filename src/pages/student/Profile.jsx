// src/pages/student/Profile.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function StudentProfile() {
  const { profile, refreshProfile } = useAuth();

  const fields = [
    { label: 'Full Name', value: profile?.name },
    { label: 'Email', value: profile?.email },
    { label: 'Enrollment ID', value: profile?.collegeId || profile?.enrollment },
    { label: 'Bus Route', value: profile?.busRoute },
    { label: 'Bus Number', value: profile?.assignedBusNumber },
    { label: 'Pickup Stop', value: profile?.pickupStop },
    { label: 'Pass Validity', value: profile?.passValidity },
    { label: 'Phone', value: profile?.phone },
  ];

  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="Profile" subtitle="Your transit account details" />

      <Card>
        <div className="p-4">
          {/* Avatar */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 font-semibold text-lg flex items-center justify-center">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{profile?.name || 'Student'}</div>
              <div className="text-xs text-gray-500">{profile?.email || ''}</div>
            </div>
            <Badge variant="primary" className="ml-auto">Student</Badge>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
