import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Logo size={28} />
            <span className="text-base font-black text-royal-900">Reviewencer</span>
          </div>
          <p className="text-xs leading-relaxed text-stone-600">
            The AI-powered review platform for the UAE. Real voices, verified phones,
            legally compliant. We don&apos;t sell five-star fantasies — we help people choose.
          </p>
        </div>

        <FooterCol title="Discover">
          <FooterLink href="/ask">Ask Reviewencer</FooterLink>
          <FooterLink href="/categories">Categories</FooterLink>
          <FooterLink href="/feed">Video feed</FooterLink>
          <FooterLink href="/record">Record a review</FooterLink>
        </FooterCol>

        <FooterCol title="Company">
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/business">For businesses</FooterLink>
          <FooterLink href="/press">Press</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink href="/legal/terms">Terms</FooterLink>
          <FooterLink href="/legal/privacy">Privacy</FooterLink>
          <FooterLink href="/legal/community">Community rules</FooterLink>
          <FooterLink href="/legal/uae-compliance">UAE compliance</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-stone-200 bg-cream-50/50">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-4 text-[11px] text-stone-500 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span>© {year} Reviewencer — reviewencer.ae</span>
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-royal-700">
              <ShieldCheck size={12} /> Compliant with UAE Federal Decree-Law 34/2021
            </span>
          </div>
          <div>Built with trust 🇦🇪 · EN / العربية</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-royal-700">{title}</div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-xs text-stone-600 hover:text-royal-900 hover:underline">
        {children}
      </Link>
    </li>
  );
}
