'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Inbox,
  FileSearch,
  History,
  Settings,
  BarChart3,
  Lightbulb,
  Brain,
  ClipboardCheck,
} from 'lucide-react';

/**
 * Required UI Screens (from Operating Parameters):
 * 1. Inbox (Lane A output) - Today's ideas with Promote/Reject buttons
 * 2. Research Queue (Lane B input) - Promoted ideas awaiting deep research
 * 3. Packets (Lane B output) - Completed research packets
 * 4. Run History - Audit trail of all DAG runs
 * 5. Settings - System configuration
 * 6. Memory Search - Rejection shadows and reappearance deltas
 * 7. QA Report - Weekly quality assurance metrics
 * 
 * Additional:
 * - Idea Detail page (/ideas/[id]) - Full evidence and action buttons
 */
const NAV_ITEMS = [
  {
    name: 'Inbox',
    href: '/inbox',
    icon: Inbox,
    description: 'Lane A output - Today\'s ideas',
  },
  {
    name: 'Research Queue',
    href: '/queue',
    icon: FileSearch,
    description: 'Lane B input - Promoted ideas',
  },
  {
    name: 'Packets',
    href: '/packets',
    icon: Lightbulb,
    description: 'Lane B output - Research packets',
  },
  {
    name: 'Memory',
    href: '/memory',
    icon: Brain,
    description: 'Rejection shadows & reappearance deltas',
  },
  {
    name: 'QA Report',
    href: '/qa',
    icon: ClipboardCheck,
    description: 'Weekly quality assurance metrics',
  },
  {
    name: 'Run History',
    href: '/runs',
    icon: History,
    description: 'Audit trail',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'System configuration',
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <span className="font-bold text-xl text-gray-900">
              ARC Investment Factory
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || 
                (item.href === '/inbox' && pathname?.startsWith('/ideas/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  title={item.description}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
