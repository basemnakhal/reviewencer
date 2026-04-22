import Link from 'next/link';

const TRENDING = [
  'Best bank in UAE for car mortgage?',
  'Fastest food delivery in Dubai?',
  'Best 5G plan in the UAE?',
  'Most reliable ride-hailing app?',
  'Cheapest grocery delivery in Abu Dhabi?',
  'Noon vs Amazon.ae — which is better?',
];

export function TrendingChips() {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {TRENDING.map((q) => (
        <Link
          key={q}
          href={`/ask?q=${encodeURIComponent(q)}`}
          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-royal-900/80 shadow-sm transition hover:border-royal-600 hover:text-royal-700"
        >
          {q}
        </Link>
      ))}
    </div>
  );
}
