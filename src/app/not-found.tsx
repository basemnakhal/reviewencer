import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 text-6xl">🔎</div>
      <h1 className="text-2xl font-black text-royal-900">Not found</h1>
      <p className="mt-2 text-sm text-stone-600">
        That business, review, or page doesn&apos;t exist — yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-royal-900 px-5 py-2.5 text-sm font-black text-white hover:bg-royal-800"
      >
        Back to home
      </Link>
    </div>
  );
}
