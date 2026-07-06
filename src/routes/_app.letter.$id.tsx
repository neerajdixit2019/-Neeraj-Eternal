import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getLetter, setLetterKept, deleteLetter } from "@/lib/letters.functions";
import { Button } from "@/components/ui/button";
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
    if (!confirm("Let this letter go? It will not be kept anywhere.")) return;
    setWorking(true);
    try {
      await delFn({ data: { id: letter.id } });
      navigate({ to: "/home" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-20">
      <Link to="/home" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Week of {dateStr}
      </p>
      <div className="mt-1 h-px w-12 bg-border/70" />

      {letter.arc && letter.arc.some((v) => v != null) && (
        <div className="mt-6 text-foreground/70">
          <WeekArc days={letter.arc} className="-ml-1 w-full max-w-xs" label="How this week moved" />
        </div>
      )}

      {letter.check_in_echo && (
        <aside
          aria-label="How your check-in shaped this letter"
          className="mt-8 rounded-[20px] border border-border/40 bg-[color-mix(in_oklab,var(--amber)_22%,transparent)] px-5 py-4"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            From your check-in
          </p>
          <p className="mt-1.5 font-serif text-[15px] italic leading-relaxed text-foreground/80">
            {letter.check_in_echo}
          </p>
        </aside>
      )}

      <article className="mt-10 space-y-6 font-serif text-[18px] leading-[1.85] text-foreground/90">
        {paragraphs.map((para, i) => (
          <p key={i} className={i === paragraphs.length - 1 ? "italic text-foreground/80" : undefined}>
            {para}
          </p>
        ))}
      </article>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6">
        <span className="text-xs text-muted-foreground">
          {letter.kept ? "On your shelf." : "Not kept."}
        </span>
        <div className="flex flex-wrap gap-2">
          {!letter.kept && (
            <Button variant="outline" className="rounded-full" disabled={working} onClick={toggleKeep}>
              Keep this letter
            </Button>
          )}
          <Button variant="outline" className="rounded-full text-destructive" disabled={working} onClick={letGo}>
            Let it go
          </Button>
        </div>
      </div>
    </div>
  );
}