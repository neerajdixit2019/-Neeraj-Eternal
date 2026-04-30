import React from "react";
import { ArrowRight, Compass, LockKeyhole, Sparkles } from "lucide-react";

export function CompassInsightCard({ eyebrow, title, text, children }) {
  return (
    <section className="rounded-3xl bg-white/76 p-5 shadow-[0_16px_42px_rgba(88,82,120,0.11)] ring-1 ring-white/75">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
          <Compass size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">{title}</h2>
          {text && <p className="mt-3 leading-7 text-slate-600">{text}</p>}
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

export function RecommendedRoomCard({ action }) {
  if (!action) return null;

  return (
    <a
      href={action.href}
      className="group block rounded-3xl bg-slate-900 p-5 text-white shadow-[0_22px_55px_rgba(15,23,42,0.22)] ring-1 ring-slate-800/20 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/12 text-white">
          <Sparkles size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">What may help next</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-white">{action.title}</h2>
          <p className="mt-3 leading-7 text-slate-200">{action.text}</p>
        </div>
        <ArrowRight className="mt-1 shrink-0 transition group-hover:translate-x-0.5" size={20} strokeWidth={2.2} />
      </div>
    </a>
  );
}

export function PrivatePatternPanel({ stats = [] }) {
  return (
    <section className="rounded-3xl bg-white/68 p-5 shadow-[0_16px_42px_rgba(88,82,120,0.10)] ring-1 ring-white/75">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/80 text-slate-700 ring-1 ring-white">
          <LockKeyhole size={18} strokeWidth={2.2} />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">A gentle pattern</p>
          <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">Only this browser knows this.</h2>
          <p className="mt-2 leading-7 text-slate-600">These are local counts, not a grade or diagnosis.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/72 p-3 ring-1 ring-white/80">
            <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
