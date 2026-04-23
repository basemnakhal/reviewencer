'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

interface Props {
  initial: { handle: string; display_name: string; avatar_url: string };
}

export function ProfileEditor({ initial }: Props) {
  const [handle, setHandle]            = useState(initial.handle);
  const [displayName, setDisplayName]  = useState(initial.display_name);
  const [avatarUrl, setAvatarUrl]      = useState(initial.avatar_url);
  const [saving, setSaving]            = useState(false);
  const [saved, setSaved]              = useState(false);
  const [error, setError]              = useState<string | null>(null);

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const r = await fetch('/api/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, display_name: displayName, avatar_url: avatarUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-royal-700">Edit profile</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="Your name"
          />
        </Field>
        <Field label="Handle">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
            className="input"
            placeholder="handle"
          />
        </Field>
        <Field label="Avatar URL" className="sm:col-span-2">
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="input"
            placeholder="https://…"
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-royal-900 px-4 py-2 text-xs font-black text-white hover:bg-royal-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-royal-700">
            <Check size={12} /> Saved
          </span>
        )}
        {error && <span className="text-xs font-bold text-red-600">{error}</span>}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #d6d3d1;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #0D1117;
        }
        .input:focus { outline: none; border-color: #2B8BFF; }
      `}</style>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-royal-700">
        {label}
      </span>
      {children}
    </label>
  );
}
