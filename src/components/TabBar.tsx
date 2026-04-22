'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Compass, Video, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/ask',     label: 'Ask',    Icon: Sparkles },
  { href: '/feed',    label: 'Feed',   Icon: Compass  },
  { href: '/record',  label: 'Record', Icon: Video,    accent: true },
  { href: '/profile', label: 'Me',     Icon: User },
] as const;

export function TabBar() {
  const pathname = usePathname();

  // Hide on admin / auth / record flows if desired later.
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map(({ href, label, Icon, accent }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold',
                  active ? 'text-royal-700' : 'text-stone-500',
                )}
              >
                {accent ? (
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg transition',
                      'bg-brand-gradient',
                      active && 'ring-2 ring-royal-300 ring-offset-2',
                    )}
                  >
                    <Icon size={18} />
                  </span>
                ) : (
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
