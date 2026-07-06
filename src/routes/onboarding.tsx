import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Welcome — set up your quiet space | My Quiet Space" },
      { name: "description", content: "A short, gentle setup before you begin — age check, consent, and how you'd like to start." },
      { property: "og:title", content: "Welcome — set up your quiet space" },
      { property: "og:description", content: "A short, gentle setup before you begin." },
      { property: "og:url", content: "https://neeraj2019.lovable.app/onboarding" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://neeraj2019.lovable.app/onboarding" }],
  }),
});

const STRUGGLES = ["Heartbreak","Missing Someone","Loneliness","Overthinking","Anxiety","Social Media Comparison","Career Pressure","I Just Need to Write"];
const NEEDS = ["Calm down","Write freely","Understand my emotions","Stop overthinking","Sleep","Feel less alone"];

const SPEAK_STYLES = [
  "Soft and gentle",
  "Direct and practical",
  "Deep and reflective",
  "Use wisdom from Gita/scriptures only when helpful",
  "Avoid spiritual advice unless I ask",
];
const AVOID_STYLES = [
  "Don't push positivity",
  "Don't give long lectures",
  "Don't use Hindi unless I choose it",
  "Don't mention my memories unless relevant",
];

const TONE_MAP: Record<string, "gentle" | "practical" | "poetic"> = {
  "Soft and gentle": "gentle",
  "Direct and practical": "practical",
  "Deep and reflective": "poetic",
};

function Onboarding() {
  const navigate = useNavigate();
  const finish = useServerFn(completeOnboarding);
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(false);
  const [struggle, setStruggle] = useState("");
  const [mood, setMood] = useState(5);
  const [need, setNeed] = useState("");
  const [consent, setConsent] = useState(false);
  const [speakStyles, setSpeakStyles] = useState<string[]>([]);
  const [avoidStyles, setAvoidStyles] = useState<string[]>([]);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) navigate({ to: "/login" }); });
  }, [navigate]);

  const submit = async () => {
    try {
      const tone = speakStyles
        .map((s) => TONE_MAP[s])
        .find(Boolean) ?? null;
      await finish({ data: {
        age_gate_passed: true,
        primary_struggle: struggle,
        initial_mood: mood,
        initial_need: need,
        companion_tone: tone,
        speaking_styles: speakStyles,
        avoid_styles: avoidStyles,
      } });
      navigate({ to: "/home" });
    } catch (e) { toast.error((e as Error).message); }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto w-full max-w-xl glass rounded-3xl p-8 sm:p-10">{children}</div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      {step === 0 && <Card>
        <h1 className="font-serif text-3xl">First, a small check.</h1>
        <p className="mt-3 text-muted-foreground">My Quiet Space is built for adults navigating heavy feelings. It is not therapy or emergency support.</p>
        <label className="mt-8 flex items-center gap-3 cursor-pointer">
          <Checkbox checked={age} onCheckedChange={(v) => setAge(!!v)} />
          <span>I am 18 years or older.</span>
        </label>
        <Button className="mt-8 w-full h-12 rounded-xl" disabled={!age} onClick={() => setStep(1)}>Continue</Button>
      </Card>}

      {step === 1 && <Card>
        <h1 className="font-serif text-3xl">What brought you here today?</h1>
        <p className="mt-2 text-muted-foreground">There is no wrong answer.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {STRUGGLES.map((s) => (
            <button key={s} onClick={() => setStruggle(s)}
              className={`rounded-xl border p-3 text-left text-sm transition ${struggle===s ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              {s}
            </button>
          ))}
        </div>
        <Button className="mt-8 w-full h-12 rounded-xl" disabled={!struggle} onClick={() => setStep(2)}>Continue</Button>
      </Card>}

      {step === 2 && <Card>
        <h1 className="font-serif text-3xl">How are you feeling right now?</h1>
        <p className="mt-2 text-muted-foreground">Just a number — it does not have to be right.</p>
        <div className="mt-10">
          <Slider value={[mood]} min={1} max={10} step={1} onValueChange={(v) => setMood(v[0])} />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>heavy</span><span className="text-2xl text-foreground">{mood}</span><span>lighter</span></div>
        </div>
        <Button className="mt-8 w-full h-12 rounded-xl" onClick={() => setStep(3)}>Continue</Button>
      </Card>}

      {step === 3 && <Card>
        <h1 className="font-serif text-3xl">What do you need most today?</h1>
        <div className="mt-6 space-y-2">
          {NEEDS.map((n) => (
            <button key={n} onClick={() => setNeed(n)}
              className={`block w-full rounded-xl border p-3 text-left text-sm transition ${need===n ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              {n}
            </button>
          ))}
        </div>
        <Button className="mt-8 w-full h-12 rounded-xl" disabled={!need} onClick={() => setStep(4)}>Continue</Button>
      </Card>}

      {step === 4 && <Card>
        <h1 className="font-serif text-3xl">How should InnerMate speak to you?</h1>
        <p className="mt-2 text-muted-foreground">Optional. You can change this anytime in Settings.</p>
        <div className="mt-6 space-y-2">
          {SPEAK_STYLES.map((s) => (
            <button key={s} onClick={() => toggle(speakStyles, setSpeakStyles, s)}
              className={`block w-full rounded-xl border p-3 text-left text-sm transition ${speakStyles.includes(s) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              {s}
            </button>
          ))}
        </div>
        <p className="mt-6 font-serif text-lg">What should InnerMate avoid?</p>
        <div className="mt-3 space-y-2">
          {AVOID_STYLES.map((s) => (
            <button key={s} onClick={() => toggle(avoidStyles, setAvoidStyles, s)}
              className={`block w-full rounded-xl border p-3 text-left text-sm transition ${avoidStyles.includes(s) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="mt-8 flex gap-2">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setStep(5)}>Skip</Button>
          <Button className="flex-1 h-12 rounded-xl" onClick={() => setStep(5)}>Continue</Button>
        </div>
      </Card>}

      {step === 5 && <Card>
        <h1 className="font-serif text-3xl">A small promise.</h1>
        <label className="mt-6 flex items-start gap-3 cursor-pointer rounded-2xl border border-border p-4">
          <Checkbox className="mt-1" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
          <span className="text-sm">I understand this is not therapy or emergency support. I consent to store my journal and mood data privately, scoped only to me.</span>
        </label>
        <Button className="mt-8 w-full h-12 rounded-xl" disabled={!consent} onClick={submit}>Enter my space</Button>
      </Card>}
    </div>
  );
}