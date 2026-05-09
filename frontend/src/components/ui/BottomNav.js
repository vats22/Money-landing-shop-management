import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Menu } from 'lucide-react';

export default function BottomNav({ items = [], onMore }) {
  const location = useLocation();
  const isActive = (href) => href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-slate-200 safe-bottom"
      data-testid="bottom-nav"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-4">
        {items.slice(0, 3).map((item) => (
          <li key={item.name}>
            <Link
              to={item.href}
              data-testid={`bottomnav-${item.name.toLowerCase()}`}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 tap-target text-[11px] font-medium transition-colors ${
                isActive(item.href) ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.href) ? 'text-emerald-700' : ''}`} />
              <span>{item.name}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            onClick={onMore}
            data-testid="bottomnav-more"
            className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 tap-target text-[11px] font-medium text-slate-500 hover:text-slate-700"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export const defaultBottomNavItems = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: FileText },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];
