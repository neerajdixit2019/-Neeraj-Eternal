import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getLetter, setLetterKept, deleteLetter } from "@/lib/letters.functions";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { WeekArc } from "@/components/WeekArc";

export const Route = createFileRoute("/_app/letter/$id")({
  component: LetterPage,
  head: () => ({
    meta: [
      { title: "A letter | My Quiet Space" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type LetterRow = {
  id: string;
  week_start: string;
  body: string;
  ritual: string | null;
  tone: "gentle" | "tender";
  kept: boolean;
  generated_at: string;
  check_in_echo: string | null;
  arc?: (number | null)[];
};

function LetterPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getLetter);
  const keepFn = useServerFn(setLetterKept);
  const delFn = useServerFn(deleteLetter);

  const { data: letter, isLoading, refetch } = useQuery({
    queryKey: ["letter", id],
    queryFn: () => getFn({ data: { id } }) as Promise<LetterRow | null>,
  });

  const [working, setWorking] = useState(false);
  const [confirmingLetGo, setConfirmingLetGo] = useState(false);
  // The in-world confirm must not lose the keyboard: focus moves into it when
  // it opens and returns to the trigger when it closes.
  const letGoTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmYesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingLetGo) confirmYesRef.current?.focus();
  }, [confirmingLetGo]);
  const cancelLetGo = () => {
    setConfirmingLetGo(false);
    requestAnimationFrame(() => letGoTriggerRef.current?.focus());
  };

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">…</div>;
  }
  if (!letter) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <p className="font-serif text-2xl">This letter isn't here.</p>
        <Link to="/home" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">← Back home</Link>
      </div>
    );
  }

  const dateStr = new Date(letter.week_start + "T00:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });

  const paragraphs = letter.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  // Ink mixes for writing on the paper sheet. Faint ink stays AA-readable —
  // pencil, not ghost.
  const inkFaint = "color-mix(in oklab, var(--ink) 66%, var(--paper))";
  const inkSoft = "color-mix(in oklab, var(--ink) 80%, var(--paper))";
  const inkHair = "color-mix(in oklab, var(--ink) 14%, transparent)";

  const toggleKeep = async () => {
    setWorking(true);
    try {
      await keepFn({ data: { id: letter.id, kept: !letter.kept } });
      toast.success(!letter.kept ? "Kept." : "Removed from your shelf.");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  const letGo = async () => {
    setWorking(true);
    try {
      await delFn({ data: { id: letter.id } });
      navigate({ to: "/home" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      <Link to="/home" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      <p className="qs-section-label mt-10">the moon cycle · a letter from your week</p>

      {/* THE LETTER — a full sheet of paper under the lamp: the drop-capped
          Newsreader letter the whole direction was built to earn. */}
      <div
        className="mt-5 rounded-[4px] p-6 sm:p-9"
        style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)" }}
      >
        {/* the week, drawn as a thin dawnline arc above the salutation */}
        {letter.arc && letter.arc.some((v) => v != null) && (
          <div className="mx-auto max-w-[260px]" style={{ color: "var(--dawnline)" }}>
            <WeekArc days={letter.arc} height={48} className="w-full" label="How this week moved" />
          </div>
        )}

        <p className="mt-4 text-center font-serif text-[13px] italic" style={{ color: inkFaint }}>
          week of {dateStr}
        </p>

        {letter.check_in_echo && (
          <p
            className="mx-auto mt-4 max-w-[46ch] text-center text-[12.5px] italic leading-relaxed"
            style={{ color: inkFaint }}
          >
            from your check-in — “{letter.check_in_echo}”
          </p>
        )}

        <article className="font-reading reading-text [--reading-px:17px] mt-7 space-y-6 leading-[1.85]" style={{ color: inkSoft }}>
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className={`${i === 0 ? "letter-dropcap " : ""}${i === paragraphs.length - 1 ? "italic" : ""}`.trim() || undefined}
            >
              {para}
            </p>
          ))}
        </article>

        <p className="mt-8 border-t pt-4 text-[11.5px] italic" style={{ borderColor: inkHair, color: inkFaint }}>
          written from your week, read by no one else.
        </p>
      </div>

      {/* the desk beneath the letter — keep is brass; letting go is a small clay
          margin action with an in-world two-step, never a browser dialog. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {letter.kept ? "on your shelf." : "not kept."}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {!letter.kept && (
            <button type="button" className="qs-pill-cta" disabled={working} onClick={toggleKeep}>
              Keep this letter
            </button>
          )}
          <button
            ref={letGoTriggerRef}
            type="button"
            disabled={working || confirmingLetGo}
            aria-expanded={confirmingLetGo}
            onClick={() => setConfirmingLetGo(true)}
            className="inline-flex min-h-11 items-center text-[12.5px] underline-offset-4 transition hover:underline disabled:opacity-50"
            style={{ color: "var(--rose)" }}
          >
            let it go
          </button>
        </div>
      </div>

      {confirmingLetGo && (
        <div
          className="fade-in mt-4 border-l-2 py-2 pl-4"
          style={{ borderColor: "var(--clay)" }}
          role="alertdialog"
          aria-label="Confirm letting this letter go"
          onKeyDown={(e) => { if (e.key === "Escape") cancelLetGo(); }}
        >
          <p className="text-[13.5px] leading-relaxed text-secondary-foreground">
            let this letter go? it won't be kept anywhere — that's a true goodbye.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-6">
            <button
              ref={confirmYesRef}
              type="button"
              disabled={working}
              onClick={letGo}
              className="inline-flex min-h-11 items-center text-[13px] font-medium underline-offset-4 transition hover:underline disabled:opacity-60"
              style={{ color: "var(--rose)" }}
            >
              {working ? "letting go…" : "yes, let it go"}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={cancelLetGo}
              className="inline-flex min-h-11 items-center text-[13px] text-muted-foreground transition hover:text-foreground"
            >
              keep it after all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
