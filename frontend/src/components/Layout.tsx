import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield, Activity, FlaskConical, MessageSquare, MailWarning, Settings, Users, FileText, Radar, HeartPulse } from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Shield },
  { to: '/incidents', label: 'Incident Management', icon: HeartPulse },
  { to: '/threat-intelligence', label: 'Threat Intelligence', icon: Radar },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/system-health', label: 'System Health', icon: Activity },
];

const settingsItems = [
  { to: '/configuration', label: 'Configuration', icon: Settings },
  { to: '/users', label: 'User Management', icon: Users },
];

export default function Layout() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
      });
      const dateString = now.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
      const element = document.getElementById('current-time');
      if (element) {
        element.textContent = `LIVE • ${dateString} ${timeString} IST`;
      }
    };
    
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--gov-navy)] text-white flex-shrink-0 hidden md:flex flex-col h-screen fixed left-0 top-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[var(--gov-saffron)]">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="font-bold text-lg tracking-wide">KAVACH</h1>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            
            <div className="pt-4 mt-4 border-t border-white/10">
              <p className="px-3 text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Settings
              </p>
              {settingsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--gov-saffron)]/80 flex items-center justify-center text-[var(--gov-navy)] font-bold text-sm">
              JS
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium">Joint Secretary</p>
              <p className="text-xs text-white/50">MeitY Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10 shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-slate-800 font-bold text-lg leading-tight">
              Ministry of Electronics &amp; Information Technology
            </h2>
            <p className="text-slate-500 text-xs">
              Government of India • Cyber Security Division
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="text-slate-500 cursor-pointer hover:text-[var(--gov-navy)]">🔔</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-[var(--gov-saffron)] rounded-full"></span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">SOC Operations Center</p>
              <p className="text-xs text-slate-500" id="current-time">LIVE MONITORING</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--bg-page)] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}