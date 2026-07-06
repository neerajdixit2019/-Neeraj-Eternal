import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPath, completeStep } from "@/lib/data.functions";
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
    const url = `https://neeraj2019.lovable.app/heal/${params.slug}`;
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
  const qc = useQueryClient();
  const fn = useServerFn(getPath);
  const cmp = useServerFn(completeStep);
  const { data } = useQuery({ queryKey: ["path", slug], queryFn: () => fn({ data: { slug } }) });
  if (!data?.path) return <div className="px-6 py-12">Path not found.</div>;

  const completed = new Set(data.progress?.completed_steps ?? []);

  return (
    <div className="motion-calm mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link to="/heal" className="text-sm text-muted-foreground">← all paths</Link>
      <h1 className="mt-4 font-serif text-3xl sm:text-4xl">{data.path.title}</h1>
      <p className="mt-3 text-muted-foreground">{data.path.description}</p>

      <div className="mt-10 space-y-4">
        {data.steps.map(s => {
          const isDone = completed.has(s.day_number);
          return (
            <div key={s.id} className={`glass rounded-3xl p-6 ${isDone ? "opacity-60" : ""}`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Day {s.day_number}</p>
              <h3 className="mt-1 font-serif text-xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed">{s.exercise_text}</p>
              <div className="mt-4 rounded-2xl bg-muted/50 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Journal prompt</p>
                <p className="mt-1 font-serif">{s.journal_prompt}</p>
              </div>
              <Button
                variant={isDone ? "secondary" : "default"}
                className="mt-4 rounded-full"
                onClick={async () => {
                  await cmp({ data: { path_id: data.path!.id, day: s.day_number } });
                  qc.invalidateQueries({ queryKey: ["path", slug] });
                  toast.success("One quiet step taken.");
                }}>
                {isDone ? <><Check className="mr-1 h-4 w-4" />Completed</> : "Mark complete"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}