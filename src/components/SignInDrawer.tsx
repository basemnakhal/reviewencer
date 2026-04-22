'use client';

/**
 * SignInDrawer — bottom sheet (mobile) / centered modal (desktop) for UAE
 * phone OTP. Two steps:
 *   1. enter phone   → POST /api/auth/otp/start
 *   2. enter 6-digit → POST /api/auth/otp/verify
 */
import { useState } from 'react';
import { X, MessageCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'phone' | 'code' | 'done';

export function SignInDrawer({ open, onOpenChange }: Props) {
  const [step, setStep]   = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | null>(null);

  if (!open) return null;

  const reset = () => { setStep('phone'); setCode(''); setError(null); };

  async function startOtp() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/auth/otp/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel: 'whatsapp' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed');
      setChannel(data.channel ?? 'whatsapp');
      setStep('code');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Failed');
      setStep('done');
      setTimeout(() => { onOpenChange(false); reset(); window.location.reload(); }, 800);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-royal-900/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <button
          onClick={() => { onOpenChange(false); reset(); }}
          className="absolute right-4 top-4 rounded-full p-1.5 text-royal-900/50 hover:bg-stone-100"
          aria-label="Close"
        ><X size={18} /></button>

        <div className="mb-4 flex items-center gap-2 text-royal-600">
          <ShieldCheck size={18} />
          <span className="text-[11px] font-bold uppercase tracking-wider">UAE phone verification</span>
        </div>

        {step === 'phone' && (
          <>
            <h2 className="text-2xl font-black leading-tight text-royal-900">
              Verify your UAE number
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              We send a one-time code on WhatsApp (or SMS). Your number is never shown publicly.
            </p>

            <div className="mt-6 flex items-stretch overflow-hidden rounded-xl border border-stone-300 bg-white focus-within:border-royal-600 focus-within:ring-2 focus-within:ring-royal-100">
              <span className="flex items-center bg-stone-50 px-3 text-sm font-bold text-royal-900">+971</span>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="50 123 4567"
                inputMode="tel"
                className="flex-1 px-3 py-3 text-base outline-none"
                autoFocus
              />
            </div>

            <button
              onClick={startOtp}
              disabled={loading || phone.length < 8}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-royal-600 px-4 py-3 text-sm font-black text-white transition hover:bg-royal-700 disabled:opacity-50"
            >
              <MessageCircle size={16} />
              {loading ? 'Sending…' : 'Send code on WhatsApp'}
            </button>
            <p className="mt-3 text-center text-[11px] text-stone-500">
              3 attempts per hour · +971 5x numbers only
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <h2 className="text-2xl font-black leading-tight text-royal-900">Enter the code</h2>
            <p className="mt-1 text-sm text-stone-600">
              Sent to <b className="text-royal-900">+971 {phone}</b> via {channel ?? 'WhatsApp'}.
            </p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="mt-6 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-royal-600 focus:ring-2 focus:ring-royal-100"
              autoFocus
            />
            <button
              onClick={verifyOtp}
              disabled={loading || code.length < 4}
              className="mt-4 w-full rounded-xl bg-royal-600 px-4 py-3 text-sm font-black text-white transition hover:bg-royal-700 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button
              onClick={reset}
              className="mt-2 w-full text-center text-xs font-semibold text-stone-500 hover:text-royal-600"
            >Change number</button>
          </>
        )}

        {step === 'done' && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-gold-600">
              <ShieldCheck size={30} />
            </div>
            <h2 className="text-xl font-black text-royal-900">You're in.</h2>
            <p className="mt-1 text-sm text-stone-600">Welcome to Reviewencer.</p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
