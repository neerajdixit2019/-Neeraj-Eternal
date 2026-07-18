import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  type TrustedLetterInput,
  LETTER_COVER_EYEBROW,
  LETTER_COVER_TITLE,
  LETTER_NOTHING_UNTICKED,
  LETTER_CLOSING,
  LETTER_SECTIONS,
  LETTER_DISCLAIMERS,
} from "@/lib/trusted-letter";

/**
 * The fair copy — the trusted letter typeset by the browser itself, which
 * shapes Devanagari (and everything else) perfectly, unlike jsPDF. Hidden
 * on screen; @media print rules in styles.css show ONLY this sheet while
 * it is mounted (guarded by the body class so printing any other page of
 * the app is unaffected). Every line of shared copy comes from the same
 * constants as the downloaded PDF, so the two renderings cannot drift.
 */
export function FairCopySheet({ input }: { input: TrustedLetterInput }) {
  useEffect(() => {
    document.body.classList.add("fair-copy-printing");
    return () => document.body.classList.remove("fair-copy-printing");
  }, []);

  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const contents: string[] = [];
  if (input.personalNote.trim()) contents.push("a note in my own words");
  if (input.moodOverview) contents.push("how my days have felt");
  if (input.patterns && input.patterns.length) contents.push("patterns I've noticed");
  if (input.journalEntries.length) {
    contents.push(
      `${input.journalEntries.length} journal page${input.journalEntries.length === 1 ? "" : "s"} I chose to share`,
    );
  }
  const m = input.moodOverview;

  return createPortal(
    <div className="fair-copy-sheet" aria-hidden="true">
      <p className="fc-eyebrow">{LETTER_COVER_EYEBROW}</p>
      <h1 className="fc-title">{LETTER_COVER_TITLE}</h1>
      {input.forName.trim() && <p className="fc-for">For {input.forName.trim()}</p>}
      {input.preparedBy && <p className="fc-by">Prepared by {input.preparedBy}</p>}
      <p className="fc-meta">{date} · covering {input.windowLabel}</p>
      <p className="fc-inside">Inside: {contents.join(" · ")}.</p>
      <p className="fc-note">{LETTER_NOTHING_UNTICKED}</p>

      {input.personalNote.trim() && (
        <section>
          <h2>{LETTER_SECTIONS.ownWords}</h2>
          <p className="fc-own-words">{input.personalNote.trim()}</p>
        </section>
      )}

      {m && (
        <section>
          <h2>{LETTER_SECTIONS.days}</h2>
          <p>
            {m.count} check-in{m.count === 1 ? "" : "s"} in this period
            {m.avg != null ? ` · average mood ${m.avg.toFixed(1)} / 10` : ""}.
          </p>
          {m.topEmotions.length > 0 && (
            <p>Feelings I named most: {m.topEmotions.map(([t, n]) => `${t} (${n}×)`).join(", ")}.</p>
          )}
          {m.topTriggers.length > 0 && (
            <p>What they tended to arrive with: {m.topTriggers.map(([t, n]) => `${t} (${n}×)`).join(", ")}.</p>
          )}
          <p className="fc-note">{LETTER_DISCLAIMERS.moods}</p>
        </section>
      )}

      {input.patterns && input.patterns.length > 0 && (
        <section>
          <h2>{LETTER_SECTIONS.patterns}</h2>
          <ul>
            {input.patterns.map((p) => (
              <li key={p.label}>
                {p.label} — appeared {p.count} time{p.count === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
          <p className="fc-note">{LETTER_DISCLAIMERS.patterns}</p>
        </section>
      )}

      {input.journalEntries.length > 0 && (
        <section className="fc-pages">
          <h2>{LETTER_SECTIONS.pages}</h2>
          {input.journalEntries.map((e, i) => (
            <article key={i}>
              <p className="fc-meta">{fmt(e.created_at)}</p>
              {e.title?.trim() && <h3>{e.title.trim()}</h3>}
              <p className="fc-body">{e.body.trim()}</p>
            </article>
          ))}
        </section>
      )}

      <p className="fc-closing">{LETTER_CLOSING}</p>
    </div>,
    document.body,
  );
}
