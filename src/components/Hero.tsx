import { Sparkles } from 'lucide-react';
import { ChatInput } from '@/components/ChatInput';
import { TrendingChips } from '@/components/TrendingChips';

/**
 * Home hero — chat-first. The brand gradient runs through the tagline.
 * Works with zero content; the Ask box is the product.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="grain absolute inset-0 -z-10" />

      <div className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center sm:pt-20">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-royal-200 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-royal-700">
          <Sparkles size={12} className="text-gold-500" />
          UAE · AI-powered reviews
        </div>

        <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-royal-900 sm:text-6xl">
          Stop reading a hundred reviews.
          <br />
          <span className="gradient-text">Just ask.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone-600 sm:text-lg">
          Ask about any UAE business — banks, delivery, telecom, e-commerce, ride-hailing.
          Get a one-screen answer from real, verified reviewers.
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <ChatInput placeholder="Best bank in UAE for car mortgage?" />
        </div>

        <div className="mt-6">
          <TrendingChips />
        </div>
      </div>
    </section>
  );
}
