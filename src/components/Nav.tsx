'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Video, User2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { SignInDrawer } from '@/components/SignInDrawer';

interface MeResponse {
  user: { id: string; phone: string | null } | null;
  profile: { id: string; handle: string | null; display_name: string | null; role: string } | null;
}

export function Nav() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const signedIn = !!me?.user;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-cream-50/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Reviewencer home">
            <Logo size={32} />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-royal-900/80 md:flex">
            <Link href="/?mode=ask"  className="hover:text-royal-600">Ask AI</Link>
            <Link href="/?mode=feed" className="hover:text-royal-600">Feed</Link>
            <Link href="/categories" className="hover:text-royal-600">Categories</Link>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center overflow-hidden rounded-full border border-stone-300 bg-white text-xs font-bold sm:flex">
              <button
                onClick={() => setLang('en')}
                className={cn('px-2.5 py-1', lang === 'en' ? 'bg-royal-600 text-white' : 'text-royal-900/60')}
              >EN</button>
              <button
                onClick={() => setLang('ar')}
                className={cn('px-2.5 py-1 font-arabic', lang === 'ar' ? 'bg-royal-600 text-white' : 'text-royal-900/60')}
              >عربي</button>
            </div>

            <Link
              href="/record"
              className="hidden items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-royal-900 shadow-sm transition hover:bg-gold-400 sm:inline-flex"
            >
              <Video size={14} /> Review
            </Link>

            {signedIn ? (
              <Link
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-600 text-white shadow-sm"
                title={me?.profile?.display_name ?? 'Profile'}
              >
                <User2 size={14} />
              </Link>
            ) : (
              <button
                onClick={() => setSignInOpen(true)}
                className="rounded-full border border-royal-600 px-3 py-1.5 text-xs font-bold text-royal-700 hover:bg-royal-50"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <SignInDrawer open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}
