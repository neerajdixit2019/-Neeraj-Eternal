import { createFileRoute, Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

export const Route = createFileRoute("/_app/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Data & Privacy | My Quiet Space" },
      { name: "description", content: "What's saved, what AI can read, what export includes, and what delete removes." },
      { property: "og:title", content: "Data & Privacy — My Quiet Space" },
      { property: "og:description", content: "Plain-language summary of how your entries, moods, and reflections are handled." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* One sober paper document. The two questions people actually come here for
   ("what does the AI read", "what does delete keep") are the first two
   chapters, each linking to its real control. Every disclosure sentence is
   preserved verbatim from the previous version of this page.

   Bilingual (Phase 22): informed consent means nothing a Hindi reader can't
   read. Every disclosure sentence renders through tx(); the inline links keep
   the same JSX position in both languages (the lead text before each link is
   per-language so it reads naturally — English "…in", Hindi "… —"). The Hindi
   is gender-neutral (passive/noun framings) and never softens or omits what is
   kept for safety/legal reasons — the list must match the code, in both tongues. */

function Chapter({ numeral, title, children }: { numeral: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 border-t pt-6 first:mt-0 first:border-t-0 first:pt-0" style={{ borderColor: "color-mix(in oklab, var(--ink) 14%, transparent)" }}>
      <h2 className="font-serif text-[19px] font-light">
        <span aria-hidden className="mr-2 text-[13px] italic" style={{ color: "color-mix(in oklab, var(--ink) 68%, var(--paper))" }}>{numeral}</span>
        {title}
      </h2>
      <div className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "color-mix(in oklab, var(--ink) 80%, var(--paper))" }}>
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  const lang = useLang();
  const inkFaint = "color-mix(in oklab, var(--ink) 66%, var(--paper))";
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="qs-section-label">{tx(lang, "the sanctuary · a document")}</p>
      <h1 className="mt-3 font-serif text-3xl font-light leading-tight tracking-tight">{tx(lang, "Your data, in plain language.")}</h1>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
        {tx(lang, "This page is maintained by the app to answer common privacy questions about My Quiet Space. It describes what the app does today — it is not a legal document or a certification.")}
      </p>

      <div
        className="mt-7 rounded-[4px] p-6 sm:p-8"
        style={{ background: "var(--paper)", color: "var(--ink)", boxShadow: "0 16px 48px rgba(10, 8, 4, 0.5)" }}
      >
        <Chapter numeral="i" title={tx(lang, "What the AI can read")}>
          <ul className="space-y-1.5">
            <li>· {tx(lang, "Messages you write to the Companion or in a Reflection.")}</li>
            <li>· {tx(lang, "Your tone preference and primary struggle (if set).")}</li>
            <li>· {tx(lang, "A memory or \"story\" field only if you toggled \"AI may read this\" on that item.")}</li>
            <li>· {tx(lang, "Your journal entries are not sent to the AI unless you paste them in.")}</li>
            <li>· {tx(lang, "The AI replies are generated through Lovable AI Gateway and not used to train external models.")}</li>
          </ul>
          <p className="mt-2.5 text-[12.5px] italic" style={{ color: inkFaint }}>
            {tx(lang, "the toggles themselves: per-memory consent lives on each memory in")}{" "}
            <Link to="/memories" className="underline underline-offset-2">{tx(lang, "Memories")}</Link>
            {tx(lang, "; tone and story controls live in")}{" "}
            <Link to="/settings" className="underline underline-offset-2">{tx(lang, "the Sanctuary")}</Link>{tx(lang, ".")}
          </p>
        </Chapter>

        <Chapter numeral="ii" title={tx(lang, "What delete removes — and keeps")}>
          <p>
            {tx(lang, "Choosing \"delete my data\" removes your mood logs, journal entries, memories (and their media), AI conversations and messages, reflection sessions and turns, weekly letters, story fields, path progress, and feedback.")}
          </p>
          <p className="mt-2">
            {tx(lang, "For safety and legal reasons, a small set of records is kept:")}{" "}
            <strong>{tx(lang, "safety events")}</strong> {tx(lang, "(crisis flags),")}{" "}
            <strong>{tx(lang, "consent records")}</strong>{tx(lang, ", and a log of your")}{" "}
            <strong>{tx(lang, "data-rights requests")}</strong>{tx(lang, ". These don't contain your journal text. To erase your account entirely, contact support.")}
          </p>
          <p className="mt-2.5 text-[12.5px] italic" style={{ color: inkFaint }}>
            {tx(lang, "the control itself: \"delete my data\" lives at the end of")}{" "}
            <Link to="/settings" className="underline underline-offset-2">{tx(lang, "the Sanctuary")}</Link>{tx(lang, ".")}
          </p>
        </Chapter>

        <Chapter numeral="iii" title={tx(lang, "What we save")}>
          <ul className="space-y-1.5">
            <li>· {tx(lang, "Your profile and preferences (name, tone, settings).")}</li>
            <li>· {tx(lang, "Mood check-ins, journal entries, memories, and your \"story\" fields.")}</li>
            <li>· {tx(lang, "Conversations with the Companion and guided Reflection sessions.")}</li>
            <li>· {tx(lang, "Weekly letters and your progress on healing paths.")}</li>
            <li>· {tx(lang, "Urge Shield pauses you choose to save.")}</li>
            <li>· {tx(lang, "Safety events (e.g. when crisis language is detected) — retained for safety auditing.")}</li>
            <li>· {tx(lang, "Consent records and any data-rights requests — retained for legal compliance.")}</li>
          </ul>
        </Chapter>

        <Chapter numeral="iv" title={tx(lang, "Screen Privacy Mode")}>
          <p>
            {tx(lang, "The eye icon in the corner toggles a visual blur over sensitive text on screen — useful if someone is near you. It is")}{" "}
            <strong>{tx(lang, "not encryption")}</strong>{tx(lang, ". The text is still stored normally in the database and is readable by you when the mode is off.")}
          </p>
        </Chapter>

        <Chapter numeral="v" title={tx(lang, "What export gives you")}>
          <p>
            {tx(lang, "A JSON file with your profile, mood logs, journal entries, memories, story, AI conversations and messages, reflection sessions and turns, weekly letters, path progress, feedback, and consent records. Media files (e.g. memory photos) are referenced by path; you can re-download them individually from the Memories page.")}
          </p>
          <p className="mt-2 text-[12.5px]" style={{ color: inkFaint }}>
            {tx(lang, "You can run an export any time from")}{" "}
            <Link to="/settings" className="underline underline-offset-2">{tx(lang, "Settings")}</Link>{tx(lang, ".")}
          </p>
        </Chapter>

        <p className="mt-7 border-t pt-4 text-[11.5px] italic" style={{ borderColor: "color-mix(in oklab, var(--ink) 14%, transparent)", color: inkFaint }}>
          {tx(lang, "nothing on this page is marketing — it is the same list the code enforces.")}
        </p>
      </div>

      <p className="mt-8 text-center text-[13px] italic text-muted-foreground">
        {tx(lang, "This app is a companion, not a clinician. In a crisis, please call a local helpline.")}
      </p>
    </div>
  );
}
