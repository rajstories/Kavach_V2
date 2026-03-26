import React from 'react';
import { GovernmentCard } from '../components/GovernmentCard';

export default function Reports() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Reports</h2>
      <GovernmentCard>
        <p className="text-slate-600">Security reports and analytics coming soon.</p>
      </GovernmentCard>
    </div>
  );
}
