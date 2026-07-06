import { useEffect, useState } from "react";

type Metrics = {
  bgLoadMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number;
  fps: number;
  droppedFrames: number;
  longTasks: number;
  scrolling: boolean;
};

const STORAGE_KEY = "lovable:perf-debug:open";

function isEnabled() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("debug") === "perf") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PerfDebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [m, setM] = useState<Metrics>({
    bgLoadMs: null,
    fcpMs: null,
    lcpMs: null,
    cls: 0,
    fps: 0,
    droppedFrames: 0,
    longTasks: 0,
    scrolling: false,
  });

  useEffect(() => {
    setEnabled(isEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // ---- Background image load time
    const navStart = performance.timeOrigin;
    const measureBg = () => {
      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const bg = entries.find((e) => e.name.includes("/bg-landscape.svg"));
      if (bg) {
        setM((p) => ({
          ...p,
          bgLoadMs: Math.round(bg.responseEnd - bg.startTime),
        }));
      }
    };
    measureBg();
    const bgInt = window.setInterval(measureBg, 500);
    window.setTimeout(() => window.clearInterval(bgInt), 8000);

    // ---- Paint timing
    try {
      const paintObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") {
            setM((p) => ({ ...p, fcpMs: Math.round(e.startTime) }));
          }
        }
      });
      paintObs.observe({ type: "paint", buffered: true });
    } catch {}

    // ---- LCP
    let lcpObs: PerformanceObserver | undefined;
    try {
      lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) setM((p) => ({ ...p, lcpMs: Math.round(last.startTime) }));
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    // ---- CLS
    let clsValue = 0;
    let clsObs: PerformanceObserver | undefined;
    try {
      clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            setM((p) => ({ ...p, cls: Math.round(clsValue * 1000) / 1000 }));
          }
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch {}

    // ---- Long tasks
    let longTaskCount = 0;
    let longObs: PerformanceObserver | undefined;
    try {
      longObs = new PerformanceObserver((list) => {
        longTaskCount += list.getEntries().length;
        setM((p) => ({ ...p, longTasks: longTaskCount }));
      });
      longObs.observe({ type: "longtask", buffered: true });
    } catch {}

    // ---- FPS / dropped frames (sampled while scrolling + always)
    let raf = 0;
    let lastTs = performance.now();
    let frames = 0;
    let dropped = 0;
    const TARGET = 1000 / 60;
    const loop = (ts: number) => {
      const delta = ts - lastTs;
      lastTs = ts;
      frames++;
      if (delta > TARGET * 1.5) {
        dropped += Math.round(delta / TARGET) - 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const fpsInt = window.setInterval(() => {
      const fps = frames;
      frames = 0;
      setM((p) => ({ ...p, fps, droppedFrames: dropped }));
    }, 1000);

    // ---- Scroll state
    let scrollTimer = 0;
    const onScroll = () => {
      setM((p) => (p.scrolling ? p : { ...p, scrolling: true }));
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        setM((p) => ({ ...p, scrolling: false }));
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    void navStart;
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(fpsInt);
      window.clearInterval(bgInt);
      window.clearTimeout(scrollTimer);
      window.removeEventListener("scroll", onScroll);
      lcpObs?.disconnect();
      clsObs?.disconnect();
      longObs?.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;

  const fmt = (n: number | null, unit = "ms") =>
    n == null ? "…" : `${n}${unit}`;
  const clsColor =
    m.cls < 0.1 ? "#4ade80" : m.cls < 0.25 ? "#facc15" : "#f87171";
  const fpsColor =
    m.fps >= 55 ? "#4ade80" : m.fps >= 30 ? "#facc15" : "#f87171";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 99999,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 11,
        color: "#e5e7eb",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: open ? "8px 10px" : "4px 8px",
        minWidth: open ? 200 : undefined,
        pointerEvents: "auto",
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <strong style={{ fontWeight: 600 }}>perf</strong>
        <span style={{ color: fpsColor }}>
          {m.fps}fps{m.scrolling ? " ·scroll" : ""}
        </span>
      </div>
      {open && (
        <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
          <Row label="bg svg" value={fmt(m.bgLoadMs)} />
          <Row label="FCP" value={fmt(m.fcpMs)} />
          <Row label="LCP" value={fmt(m.lcpMs)} />
          <Row label="CLS" value={String(m.cls)} valueColor={clsColor} />
          <Row
            label="dropped"
            value={`${m.droppedFrames}`}
            valueColor={m.droppedFrames > 5 ? "#f87171" : undefined}
          />
          <Row label="longtask" value={`${m.longTasks}`} />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ color: valueColor }}>{value}</span>
    </div>
  );
}