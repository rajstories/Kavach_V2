import React from 'react';
import { GovernmentCard } from '../components/GovernmentCard';

export default function Configuration() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Configuration</h2>
      <GovernmentCard>
        <p className="text-slate-600">System configuration settings coming soon.</p>
      </GovernmentCard>
    </div>
  );
}
