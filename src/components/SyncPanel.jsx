import React, { useEffect, useMemo, useState } from "react";
import { Cloud, LockKeyhole, ShieldCheck, Smartphone, UploadCloud } from "lucide-react";
import { getCurrentSession, getSyncSnapshot, getSyncStatus, signInWithEmail, signOut, syncProgressSnapshot } from "../sync/syncAdapter.js";

export function SyncPanel() {
  const status = useMemo(() => getSyncStatus(), []);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const snapshot = useMemo(() => getSyncSnapshot(), [message]);

  useEffect(() => {
    let active = true;
    getCurrentSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const requestMagicLink = async () => {
    setBusy(true);
    setMessage("");
    try {
      await signInWithEmail(email.trim());
      setMessage("Check your email for the secure sign-in link.");
    } catch (error) {
      setMessage(error.message || "Sync is not ready yet.");
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setMessage("");
    try {
      await syncProgressSnapshot();
      setMessage("Progress synced. Private writing stayed on this device.");
    } catch (error) {
      setMessage(error.message || "Sync could not finish.");
    } finally {
      setBusy(false);
    }
  };

  const logOut = async () => {
    setBusy(true);
    setMessage("");
    try {
      await signOut();
      setSession(null);
      setMessage("Signed out. Local data is still here.");
    } catch (error) {
      setMessage(error.message || "Could not sign out.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sacred-card rounded-3xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <Cloud size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Optional sync</p>
            <h2 className="mt-1 text-2xl font-semibold leading-snug text-slate-900">Carry progress, not private pain.</h2>
            <p className="mt-2 leading-7 text-slate-600">Most writing stays only on this device. Sync is optional. Private text is not uploaded in this version.</p>
          </div>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-xs font-semibold ${status.configured ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" : "bg-amber-50 text-amber-800 ring-1 ring-amber-100"}`}>
          {status.configured ? "Supabase ready" : "Local-only now"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white/62 p-4 ring-1 ring-white/80">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UploadCloud size={17} />
            Syncs
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Progress, counts, selected rooms, completed dates, and non-sensitive settings.</p>
        </div>
        <div className="rounded-3xl bg-white/62 p-4 ring-1 ring-white/80">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Smartphone size={17} />
            Stays local
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Journal text, daily notes, care-kit text, museum notes, and pressure writing.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/65 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Daily days</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{snapshot.daily.completedDates.length}</p>
        </div>
        <div className="rounded-2xl bg-white/65 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Calm</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{snapshot.calm.completedCount}</p>
        </div>
        <div className="rounded-2xl bg-white/65 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Journeys</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{Object.keys(snapshot.journeys).length}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-emerald-50/80 p-4 text-sm leading-6 text-emerald-900">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 shrink-0" size={18} />
          <p>Sync is designed as a trust feature, not a growth hack. You can use the whole app without signing in.</p>
        </div>
      </div>

      {!status.configured ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-600">
          Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel to enable sign-in and progress sync.
        </div>
      ) : session ? (
        <div className="mt-5 grid gap-3">
          <p className="text-sm font-semibold text-slate-600">Signed in as {session.user.email}</p>
          <button type="button" onClick={syncNow} disabled={busy} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-400/25 transition hover:bg-slate-800 disabled:opacity-50">Sync progress</button>
          <button type="button" onClick={logOut} disabled={busy} className="min-h-12 rounded-2xl bg-white/75 px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-white disabled:opacity-50">Sign out</button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          <label className="text-sm font-semibold text-slate-600" htmlFor="sync-email">Email for magic link</label>
          <input
            id="sync-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            className="min-h-12 rounded-2xl border border-white/80 bg-white/78 px-4 text-slate-900 outline-none ring-1 ring-transparent transition focus:ring-slate-300"
          />
          <button type="button" onClick={requestMagicLink} disabled={busy || !email.trim()} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-400/25 transition hover:bg-slate-800 disabled:opacity-50">
            <span className="inline-flex items-center gap-2"><LockKeyhole size={16} /> Send secure link</span>
          </button>
        </div>
      )}

      {message && <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-600">{message}</p>}
    </section>
  );
}
