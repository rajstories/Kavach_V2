import React from 'react';
import { GovernmentCard } from '../components/GovernmentCard';

export default function SystemHealth() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">System Health</h2>
      <GovernmentCard>
        <p className="text-slate-600">System health monitoring and diagnostics coming soon.</p>
      </GovernmentCard>
    </div>
  );
}
