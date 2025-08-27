'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/src/lib/utils';
import { 
  Package, 
  BarChart3, 
  FileText, 
  AlertTriangle, 
  Settings, 
  Home,
  TrendingUp,
  MapPin,
  DollarSign
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Products',
    href: '/dashboard/products',
    icon: Package,
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: FileText,
  },
  {
    name: 'Price Trends',
    href: '/dashboard/trends',
    icon: TrendingUp,
  },
  {
    name: 'Price Alerts',
    href: '/dashboard/alerts',
    icon: AlertTriangle,
  },
  {
    name: 'Locations',
    href: '/dashboard/locations',
    icon: MapPin,
  },
  {
    name: 'Cost Analysis',
    href: '/dashboard/costs',
    icon: DollarSign,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-16 bottom-0 left-0 z-50 w-64 bg-black border-r border-gray-800 transform transition-transform duration-300 ease-in-out lg:relative lg:top-0 lg:translate-x-0 lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-white border-r-2 border-[#f29d2c]"
                    : "text-gray-300 hover:text-white"
                )}
                style={isActive ? {backgroundColor: '#f29d2c'} : {}}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f29d2c40';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 transition-colors",
                    isActive
                      ? "text-white"
                      : "text-gray-400 group-hover:text-gray-200"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-green-300">LP</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                Los Pinos Restaurants
              </p>
              <p className="text-xs text-gray-400 truncate">
                2 Locations
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}