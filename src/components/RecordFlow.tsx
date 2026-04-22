'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Square, Mic, Loader2, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { cn, truncate } from '@/lib/utils';

type Step = 'intro' | 'record' | 'preview' | 'transcribing' | 'edit' | 'submitting' | 'done' | 'error';

interface Business { id: string; name: string; slug: string; emoji?: string | null }

interface Props {
  businesses: Business[];
  defaultBusinessId?: string;
}

const MAX_SECONDS = 60;

export function RecordFlow({ businesses, defaultBusinessId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');
  const [businessId, setBusinessId] = useState<string>(defaultBusinessId ?? businesses[0]?.id ?? '');
  const [rating, setRating] = useState<number>(5);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ status: string; reasoning: string } | null>(null);

  const mediaRef    = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<BlobPart[]>([]);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const previewRef  = useRef<HTMLVideoElement>(null);

  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl,  setVideoUrl]  = useState<string | null>(null);
  const [seconds,   setSeconds]   = useState(0);

  // Tick recording timer
  useEffect(() => {
    if (step !== 'record') return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  // Cleanup on unmount
  useEffect(() => () => {
    mediaRef.current?.getTracks().forEach((tr) => tr.stop());
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  async function startRecording() {
    setError(null);
    setSeconds(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      mediaRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);
        setVideoBlob(blob);
        setVideoUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        setStep('preview');
      };
      rec.start();
      setStep('record');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera unavailable');
      setStep('error');
    }
  }

  function stopRecording() {
    recorderRef.current?.state === 'recording' && recorderRef.current?.stop();
  }

  function retake() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(null); setVideoUrl(null); setText(''); setSeconds(0);
    setStep('intro');
  }

  async function proceedToTranscribe() {
    if (!videoBlob) return;
    setStep('transcribing');
    setError(null);
    try {
      // 1) Get signed upload URL
      const ext = 'webm';
      const up = await fetch('/api/review/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ext }),
      });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error ?? 'Upload URL failed');

      // 2) PUT the video blob to Supabase signed URL
      const put = await fetch(upData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoBlob.type || 'video/webm' },
        body: videoBlob,
      });
      if (!put.ok) throw new Error('Video upload failed');

      // 3) Transcribe
      const tr = await fetch('/api/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoKey: upData.key }),
      });
      const trData = await tr.json();
      if (!tr.ok) throw new Error(trData.error ?? 'Transcription failed');

      setText(trData.text ?? '');
      (window as any).__uploadedKey = upData.key; // carry key forward
      setStep('edit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStep('error');
    }
  }

  async function submit() {
    setStep('submitting');
    setError(null);
    try {
      const r = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          rating,
          text: text.trim(),
          videoKey: (window as any).__uploadedKey ?? null,
          transcriptSource: (window as any).__uploadedKey ? 'video_transcription' : 'typed',
          tags,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Review submission failed');
      const v = data.verdict ?? {};
      setVerdict({
        status: v.status === 'auto_approved' ? 'published' : v.status ?? 'flagged',
        reasoning: v.rationale ?? '',
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
      setStep('error');
    }
  }

  const bizName = businesses.find((b) => b.id === businessId)?.name ?? '';

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Step header */}
      <StepHeader step={step} />

      {step === 'intro' && (
        <div className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-royal-900">Record your review</h1>
          <p className="text-sm text-stone-600">
            Keep it honest, keep it real. Up to {MAX_SECONDS}s. We transcribe your video
            with AI so it&apos;s searchable — you can edit the text before publishing.
          </p>

          <Field label="Business">
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-royal-900 focus:border-royal-500 focus:outline-none"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.emoji ?? '🏢') + ' ' + b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Your rating">
            <StarPicker value={rating} onChange={setRating} />
          </Field>

          <Field label="Tags (optional)">
            <TagPicker value={tags} onChange={setTags} />
          </Field>

          <button
            disabled={!businessId}
            onClick={startRecording}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-royal-500/25 transition hover:brightness-105 disabled:opacity-50"
          >
            <Video size={16} /> Start recording
          </button>
          <p className="text-center text-[11px] text-stone-500">
            By recording, you confirm your review is honest and complies with UAE law.
          </p>
        </div>
      )}

      {step === 'record' && (
        <div className="space-y-4 rounded-3xl bg-black p-4">
          <div className="relative overflow-hidden rounded-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[9/16] w-full object-cover" />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
              <span className="pulse-ring h-2 w-2 rounded-full bg-white" /> REC
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
              {seconds}s / {MAX_SECONDS}s
            </div>
          </div>
          <button
            onClick={stopRecording}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-royal-900"
          >
            <Square size={14} fill="currentColor" /> Stop
          </button>
        </div>
      )}

      {step === 'preview' && videoUrl && (
        <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <video ref={previewRef} src={videoUrl} controls playsInline className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" />
          <div className="text-center text-sm text-stone-600">
            Reviewing {bizName}. Happy with the take?
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={retake}
              className="flex items-center justify-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-royal-900 hover:border-royal-500"
            >
              <RefreshCw size={14} /> Retake
            </button>
            <button
              onClick={proceedToTranscribe}
              className="flex items-center justify-center gap-1 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-black text-white shadow hover:brightness-105"
            >
              <Mic size={14} /> Transcribe
            </button>
          </div>
        </div>
      )}

      {step === 'transcribing' && (
        <Busy label="Uploading & transcribing with Whisper…" />
      )}

      {step === 'edit' && (
        <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-royal-900">Review your transcript</h2>
          <p className="text-xs text-stone-500">
            Fix anything the AI got wrong, then post. Your video stays attached.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="What was your experience?"
            className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-royal-900 focus:border-royal-500 focus:outline-none"
          />
          <div className="text-right text-[11px] text-stone-500">{text.length} characters</div>

          <button
            disabled={text.trim().length < 10}
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-black text-white shadow-lg hover:brightness-105 disabled:opacity-50"
          >
            Post review <ArrowRight size={14} />
          </button>
          <p className="text-[11px] text-stone-500">
            Every review passes an AI moderation check aligned with UAE Federal Decree-Law 34/2021.
          </p>
        </div>
      )}

      {step === 'submitting' && <Busy label="Moderating & publishing…" />}

      {step === 'done' && verdict && (
        <div className="space-y-4 rounded-3xl border border-royal-200 bg-white p-6 text-center shadow-sm">
          {verdict.status === 'published' ? (
            <>
              <CheckCircle2 className="mx-auto text-royal-600" size={48} />
              <h2 className="text-xl font-black text-royal-900">Your review is live ✨</h2>
              <p className="text-sm text-stone-600">Thanks for speaking up — you just helped thousands of UAE residents choose smarter.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="mx-auto text-gold-500" size={48} />
              <h2 className="text-xl font-black text-royal-900">Your review is in review</h2>
              <p className="text-sm text-stone-600">
                Our AI flagged something for a human moderator. {truncate(verdict.reasoning, 200)}
              </p>
            </>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full rounded-full bg-royal-900 px-6 py-3 text-sm font-black text-white"
          >
            Back to home
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto text-red-500" size={40} />
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            onClick={retake}
            className="rounded-full bg-royal-900 px-4 py-2 text-xs font-black text-white"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const labels = ['Setup', 'Record', 'Review', 'Post'];
  const idx =
    step === 'intro' ? 0 :
    step === 'record' ? 1 :
    step === 'preview' || step === 'transcribing' ? 2 :
    step === 'edit' || step === 'submitting' ? 3 :
    4;
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
              i <= idx ? 'bg-royal-900 text-white' : 'bg-stone-200 text-stone-500',
            )}
          >
            {i + 1}
          </span>
          <span className={cn('text-[11px] font-bold', i <= idx ? 'text-royal-900' : 'text-stone-400')}>
            {l}
          </span>
          {i < labels.length - 1 && (
            <span className={cn('h-0.5 flex-1 rounded', i < idx ? 'bg-royal-900' : 'bg-stone-200')} />
          )}
        </div>
      ))}
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
      <Loader2 className="animate-spin text-royal-600" size={28} />
      <p className="text-sm font-semibold text-royal-900">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-royal-700">{label}</span>
      {children}
    </label>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          className={cn(
            'h-9 w-9 rounded-lg text-xl transition',
            n <= value ? 'bg-gold-100 text-gold-600' : 'bg-stone-100 text-stone-400',
          )}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm font-bold text-royal-900">
        <StarRating value={value} size={12} label />
      </span>
    </div>
  );
}

function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const options = ['service', 'value', 'speed', 'app', 'staff', 'delivery', 'quality', 'price'];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((t) => {
        const active = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(active ? value.filter((v) => v !== t) : [...value, t])}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-bold transition',
              active ? 'bg-royal-900 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:border-royal-300',
            )}
          >
            #{t}
          </button>
        );
      })}
    </div>
  );
}
