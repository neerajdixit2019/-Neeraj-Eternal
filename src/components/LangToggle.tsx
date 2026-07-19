import { useLang, setLang } from "@/lib/i18n";
import { tx } from "@/lib/i18n-strings";

/**
 * The pre-auth language toggle — offered before the door so a Hindi reader is
 * met in Hindi from the first screen, not only after onboarding. Writes the
 * shared `mqs-lang` store (localStorage), so login, the reset page, and the
 * app all inherit the choice. Targets clear the 44px floor (min-h-11).
 *
 * The landing (index.tsx) inlines the same control; this component is the
 * canonical one for the authenticated threshold (login / reset-password).
 */
export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <div
      role="group"
      aria-label={tx(lang, "Choose your language")}
      className={`flex items-center rounded-full border p-0.5 ${className}`}
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-11 rounded-full px-3 text-[12.5px] transition ${lang === l ? "bg-[color-mix(in_oklab,var(--lamp)_22%,transparent)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "en" ? "English" : "हिन्दी"}
        </button>
      ))}
    </div>
  );
}
