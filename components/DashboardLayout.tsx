'use client';

import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - spans full width */}
      <Header onMenuClick={toggleSidebar} />

      {/* Content area with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-white">
          <div className="px-8 pt-4 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}