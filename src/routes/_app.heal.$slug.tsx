import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPath, completeStep } from "@/lib/data.functions";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((s) => (s.length ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

export const Route = createFileRoute("/_app/heal/$slug")({
  component: PathDetail,
  head: ({ params }) => {
    const name = titleFromSlug(params.slug);
    const url = `https://innermate.lovable.app/heal/${params.slug}`;
    return {
      meta: [
        { title: `${name} — Healing path | My Quiet Space` },
        { name: "description", content: `A gentle ${name.toLowerCase()} healing path with daily steps, short exercises, and journal prompts.` },
        { property: "og:title", content: `${name} — Healing path` },
        { property: "og:description", content: `A gentle ${name.toLowerCase()} healing path with daily steps and journal prompts.` },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${name} — Healing path`,
            url,
          }),
        },
      ],
    };
  },
});

function PathDetail() {
  const { slug } = Route.useParams();
  const lang = useLang();
  const qc = useQueryClient();
  const fn = useServerFn(getPath);
  const cmp = useServerFn(completeStep);
  const { data } = useQuery({ queryKey: ["path", slug], queryFn: () => fn({ data: { slug } }) });
  if (!data?.path) {
    return (
      <div className="px-6 py-12 text-sm text-muted-foreground">
        {tx(lang, "That path isn't here.")} <Link to="/heal" className="underline">{tx(lang, "Back to all paths")}</Link>.
      </div>
    );
  }

  const completed = new Set(data.progress?.completed_steps ?? []);

  return (
    <div className="motion-calm mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link to="/heal" className="text-sm text-muted-foreground transition hover:text-foreground">← {tx(lang, "all paths")}</Link>
      <p className="qs-section-label mt-8">{tx(lang, "gentle guided paths")}</p>
      <h1 className="mt-3 font-serif text-3xl font-light leading-tight tracking-tight sm:text-4xl">{tx(lang, data.path.title)}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{tx(lang, data.path.description)}</p>

      <div className="mt-10 space-y-4">
        {data.steps.map(s => {
          const isDone = completed.has(s.day_number);
          const markDone = async () => {
            await cmp({ data: { path_id: data.path!.id, day: s.day_number } });
            qc.invalidateQueries({ queryKey: ["path", slug] });
            toast.success(tx(lang, "One quiet step taken."));
          };
          return (
            <div key={s.id} className={`glass rounded-3xl p-6 sm:p-7 ${isDone ? "opacity-60" : ""}`}>
              <p className="qs-section-label">{tx(lang, "day")} {s.day_number}</p>
              <h3 className="mt-1.5 font-serif text-xl font-light">{tx(lang, s.title)}</h3>
              <p className="mt-3 text-sm leading-relaxed">{tx(lang, s.exercise_text)}</p>
              <div className="mt-4 rounded-2xl bg-muted/50 p-4">
                <p className="qs-section-label">{tx(lang, "journal prompt")}</p>
                <p className="mt-1.5 font-serif italic">{tx(lang, s.journal_prompt)}</p>
              </div>
              {isDone ? (
                <Button variant="secondary" className="mt-5 rounded-full" onClick={markDone}>
                  <Check className="mr-1 h-4 w-4" />{tx(lang, "walked")}
                </Button>
              ) : (
                <button className="qs-pill-cta mt-5" onClick={markDone}>
                  {completed.size === 0 && s.day_number === 1 ? tx(lang, "begin this path") : tx(lang, "continue this step")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-12 text-center font-serif text-[13.5px] italic text-muted-foreground">
        {tx(lang, "one quiet day at a time.")}
      </p>
    </div>
  );
}
