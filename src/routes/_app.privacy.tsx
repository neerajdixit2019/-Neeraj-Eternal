import { createFileRoute, Link } from "@tanstack/react-router";
import { TactileCard } from "@/components/TactileCard";
import { Shield, Eye, Download, Trash2, Sparkles } from "lucide-react";

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

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Settings</p>
      <h1 className="mt-3 font-serif text-3xl leading-tight">Your data, in plain language.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        This page is maintained by the app to answer common privacy questions about My Quiet Space.
        It describes what the app does today — it is not a legal document or a certification.
      </p>

      <TactileCard tint="sky" className="mt-8">
        <div className="flex items-start gap-3">
          <Eye className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <h2 className="font-serif text-xl">What we save</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
              <li>· Your profile and preferences (name, tone, settings).</li>
              <li>· Mood check-ins, journal entries, memories, and your "story" fields.</li>
              <li>· Conversations with the Companion and guided Reflection sessions.</li>
              <li>· Weekly letters and your progress on healing paths.</li>
              <li>· Urge Shield pauses you choose to save.</li>
              <li>· Safety events (e.g. when crisis language is detected) — retained for safety auditing.</li>
              <li>· Consent records and any data-rights requests — retained for legal compliance.</li>
            </ul>
          </div>
        </div>
      </TactileCard>

      <TactileCard tint="lavender" className="mt-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <h2 className="font-serif text-xl">What the AI can read</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
              <li>· Messages you write to the Companion or in a Reflection.</li>
              <li>· Your tone preference and primary struggle (if set).</li>
              <li>· A memory or "story" field <em>only</em> if you toggled "AI may read this" on that item.</li>
              <li>· Your journal entries are <strong>not</strong> sent to the AI unless you paste them in.</li>
              <li>· The AI replies are generated through Lovable AI Gateway and not used to train external models.</li>
            </ul>
          </div>
        </div>
      </TactileCard>

      <TactileCard tint="amber" className="mt-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <h2 className="font-serif text-xl">Screen Privacy Mode</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The eye icon in the corner toggles a visual blur over sensitive text on screen — useful if
              someone is near you. It is <strong>not encryption</strong>. The text is still stored normally
              in the database and is readable by you when the mode is off.
            </p>
          </div>
        </div>
      </TactileCard>

      <TactileCard tint="mint" className="mt-5">
        <div className="flex items-start gap-3">
          <Download className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <h2 className="font-serif text-xl">What export gives you</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A JSON file with your profile, mood logs, journal entries, memories, story, AI conversations and
              messages, reflection sessions and turns, weekly letters, path progress, feedback, and consent
              records. Media files (e.g. memory photos) are referenced by path; you can re-download them
              individually from the Memories page.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You can run an export any time from <Link to="/settings" className="underline">Settings</Link>.
            </p>
          </div>
        </div>
      </TactileCard>

      <TactileCard tint="rose" className="mt-5">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <h2 className="font-serif text-xl">What delete removes</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choosing "delete my data" removes your mood logs, journal entries, memories (and their media),
              AI conversations and messages, reflection sessions and turns, weekly letters, story fields, path
              progress, and feedback.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              For safety and legal reasons, a small set of records is kept: <strong>safety events</strong>
              (crisis flags), <strong>consent records</strong>, and a log of your <strong>data-rights requests</strong>.
              These don't contain your journal text. To erase your account entirely, contact support.
            </p>
          </div>
        </div>
      </TactileCard>

      <p className="mt-10 text-center text-[13px] italic text-muted-foreground">
        This app is a companion, not a clinician. In a crisis, please call a local helpline.
      </p>
    </div>
  );
}