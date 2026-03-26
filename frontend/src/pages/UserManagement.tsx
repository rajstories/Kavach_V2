import React from 'react';
import { GovernmentCard } from '../components/GovernmentCard';

export default function UserManagement() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
      <GovernmentCard>
        <p className="text-slate-600">User access control and management coming soon.</p>
      </GovernmentCard>
    </div>
  );
}
