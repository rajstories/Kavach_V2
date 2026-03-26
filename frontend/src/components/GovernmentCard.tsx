import React from 'react';

interface GovernmentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GovernmentCard({ children, className = '', ...props }: GovernmentCardProps) {
  return (
    <div
      className={`rounded-[8px] border bg-[var(--bg-card)] p-[24px] shadow-sm ${className}`}
      style={{ borderColor: 'var(--border)' }}
      {...props}
    >
      {children}
    </div>
  );
}
