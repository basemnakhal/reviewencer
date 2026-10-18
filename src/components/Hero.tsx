import { ChatInput } from '@/components/ChatInput';
import { TrendingChips } from '@/components/TrendingChips';

export function Hero() {
  return (
    <section className="relative overflow-hidden w-full">
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border-2 border-royal-300 bg-white/80 px-5 py-2 text-sm font-black uppercase tracking-widest text-royal-700">
          🎬 UAE Reel Reviews
        </div>

        <h1 className="text-5xl font-black tracking-tight text-royal-900 whitespace-nowrap">
          Stop reading a hundred reviews. <span className="gradient-text">Just ask.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base text-stone-600 sm:text-lg">
          Ask about any UAE business — banks, delivery, telecom, e-commerce, ride-hailing.
          Get a one-screen answer from real, verified reviewers.
        </p>
        <div className="mx-auto mt-6 max-w-2xl">
          <ChatInput placeholder="Best bank in UAE for car mortgage?" />
        </div>
        <div className="mt-4">
          <TrendingChips />
        </div>
      </div>
    </section>
  );
}
