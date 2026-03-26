import React from 'react';
import { GovernmentCard } from '../components/GovernmentCard';

export default function ThreatIntelligence() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Threat Intelligence</h2>
      <GovernmentCard>
        <p className="text-slate-600">Threat intelligence feeds and analysis coming soon.</p>
      </GovernmentCard>
    </div>
  );
}
