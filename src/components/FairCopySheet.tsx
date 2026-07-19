import { useEffect } from "react";
import { createPortal } from "react-dom";
import { type TrustedLetterInput, letterCopy } from "@/lib/trusted-letter";
import { useLang } from "@/lib/i18n";

/**
 * The fair copy — the trusted letter typeset by the browser itself, which
 * shapes Devanagari (and everything else) perfectly, unlike jsPDF. Hidden
 * on screen; @media print rules in styles.css show ONLY this sheet while
 * it is mounted (guarded by the body class so printing any other page of
 * the app is unaffected). Every line of shared copy comes from the same
 * source — letterCopy(lang) — as the downloaded PDF, so the two renderings
 * (in whichever language) cannot drift.
 */
export function FairCopySheet({ input }: { input: TrustedLetterInput }) {
  const lang = useLang();
  const C = letterCopy(lang);

  useEffect(() => {
    document.body.classList.add("fair-copy-printing");
    return () => document.body.classList.remove("fair-copy-printing");
  }, []);

  const locale = lang === "hi" ? "hi-IN" : undefined;
  const date = new Date().toLocaleDateString(locale, {
    year: "numeric", month: "long", day: "numeric",
  });
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  const contents: string[] = [];
  if (input.personalNote.trim()) contents.push(C.bits.note);
  if (input.moodOverview) contents.push(C.bits.days);
  if (input.patterns && input.patterns.length) contents.push(C.bits.patterns);
  if (input.journalEntries.length) contents.push(C.bits.pages(input.journalEntries.length));
  const m = input.moodOverview;

  return createPortal(
    <div className="fair-copy-sheet" aria-hidden="true">
      <p className="fc-eyebrow">{C.coverEyebrow}</p>
      <h1 className="fc-title">{C.coverTitle}</h1>
      {input.forName.trim() && <p className="fc-for">{C.forLine(input.forName.trim())}</p>}
      {input.preparedBy && <p className="fc-by">{C.preparedByLine(input.preparedBy)}</p>}
      <p className="fc-meta">{C.metaLine(date, input.windowLabel)}</p>
      <p className="fc-inside">{C.insideLine(contents)}</p>
      <p className="fc-note">{C.nothingUnticked}</p>

      {input.personalNote.trim() && (
        <section>
          <h2>{C.sections.ownWords}</h2>
          <p className="fc-own-words">{input.personalNote.trim()}</p>
        </section>
      )}

      {m && (
        <section>
          <h2>{C.sections.days}</h2>
          <p>{C.moodCount(m.count, m.avg)}</p>
          {m.topEmotions.length > 0 && <p>{C.feelingsMost(m.topEmotions)}</p>}
          {m.topTriggers.length > 0 && <p>{C.arrivedWith(m.topTriggers)}</p>}
          <p className="fc-note">{C.disclaimers.moods}</p>
        </section>
      )}

      {input.patterns && input.patterns.length > 0 && (
        <section>
          <h2>{C.sections.patterns}</h2>
          <ul>
            {input.patterns.map((p) => (
              <li key={p.label}>{C.patternLine(p.label, p.count)}</li>
            ))}
          </ul>
          <p className="fc-note">{C.disclaimers.patterns}</p>
        </section>
      )}

      {input.journalEntries.length > 0 && (
        <section className="fc-pages">
          <h2>{C.sections.pages}</h2>
          {input.journalEntries.map((e, i) => (
            <article key={i}>
              <p className="fc-meta">{fmt(e.created_at)}</p>
              {e.title?.trim() && <h3>{e.title.trim()}</h3>}
              <p className="fc-body">{e.body.trim()}</p>
            </article>
          ))}
        </section>
      )}

      <p className="fc-closing">{C.closing}</p>
    </div>,
    document.body,
  );
}
