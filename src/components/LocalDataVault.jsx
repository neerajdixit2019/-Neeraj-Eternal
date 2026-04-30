import React, { useMemo, useState } from "react";
import { Download, RefreshCcw, Shield, Trash2 } from "lucide-react";
import { clearLocalAppData, getLocalDataArchive, getLocalDataVaultSnapshot } from "../storage/progressSnapshot.js";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function downloadArchive() {
  const archive = getLocalDataArchive();
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `neeraj-eternal-local-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function LocalDataVault() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [message, setMessage] = useState("");
  const snapshot = useMemo(() => getLocalDataVaultSnapshot(), [refreshToken]);

  const resetData = () => {
    const confirmed = window.confirm("This will clear Neeraj Eternal data saved in this browser. Private writing, progress, and local notes on this device will be removed. Continue?");
    if (!confirmed) return;
    clearLocalAppData();
    setMessage("Local app data was cleared from this browser.");
    setRefreshToken((value) => value + 1);
    window.dispatchEvent(new Event("storage"));
  };

  const exportData = () => {
    downloadArchive();
    setMessage("Private local archive downloaded on this device.");
  };

  const stats = [
    { label: "Saved spaces", value: snapshot.totalKeys },
    { label: "Local size", value: formatBytes(snapshot.totalBytes) },
    { label: "Daily days", value: snapshot.summary.dailyDays },
    { label: "Calm sessions", value: snapshot.summary.calmSessions }
  ];

  return (
    <section className="sacred-card rounded-3xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Local Data Vault</p>
            <h2 className="mt-1 text-2xl font-semibold leading-snug text-slate-900">Your device holds the private parts.</h2>
            <p className="mt-2 leading-7 text-slate-600">Review what exists in this browser, export your own archive, or reset local data when you choose.</p>
          </div>
        </div>
        <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white/72 px-3 text-xs font-semibold text-slate-600 ring-1 ring-white/80 transition hover:bg-white">
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white/65 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-2">
        {snapshot.entries.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white/58 px-4 py-3 text-sm ring-1 ring-white/70">
            <div className="min-w-0">
              <p className="font-semibold capitalize text-slate-800">{entry.id.replace(/([A-Z])/g, " $1")}</p>
              <p className="truncate text-xs text-slate-500">{entry.key}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xs font-semibold ${entry.exists ? "text-emerald-700" : "text-slate-400"}`}>{entry.exists ? "Saved" : "Empty"}</p>
              <p className="text-xs text-slate-400">{formatBytes(entry.bytes)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
        Export can include private writing. Keep the file somewhere safe and do not share it casually.
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={exportData} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-400/25 transition hover:bg-slate-800">
          <Download size={16} />
          Export local archive
        </button>
        <button type="button" onClick={resetData} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/75 px-5 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-50">
          <Trash2 size={16} />
          Reset local data
        </button>
      </div>

      {message && <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-600">{message}</p>}
    </section>
  );
}
