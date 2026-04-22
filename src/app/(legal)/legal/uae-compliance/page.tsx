export const metadata = { title: 'UAE compliance — Reviewencer' };

export default function UaeCompliancePage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 prose prose-stone">
      <h1 className="text-3xl font-black text-royal-900">UAE compliance</h1>
      <p className="text-sm text-stone-600">
        Reviewencer operates under UAE law. We actively moderate reviews for compliance with:
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-stone-700">
        <li>
          <strong>Federal Decree-Law 34 of 2021</strong> on Combating Rumours and Cybercrimes —
          we forbid defamatory content, insults, disclosure of private information, religious or
          political attacks, and hate speech.
        </li>
        <li>
          <strong>Federal Decree-Law 31 of 2021 (Penal Code)</strong> — defamation provisions,
          commercial disparagement limits.
        </li>
        <li>
          <strong>Telecommunications and Digital Government Regulatory Authority (TDRA)</strong>
          content standards.
        </li>
      </ul>
      <p className="mt-6 text-sm text-stone-600">
        Every submitted review passes an AI moderation check before publication. Flagged reviews
        are reviewed by our human team within 24 hours. Anyone can appeal a moderation decision
        through <a href="/contact" className="text-royal-700 underline">contact</a>.
      </p>
      <p className="mt-4 text-[11px] italic text-stone-500">
        Reviewencer is not a law firm. This page summarizes our policies and is not legal advice.
      </p>
    </article>
  );
}
