import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice writing — the same browser SpeechRecognition engine InnerMate's chat
 * already uses, packaged as a hook so other rooms (the journal) can take
 * dictation without touching the chat's code. Finalized phrases stream to
 * `onFinal`; the not-yet-final phrase is exposed as `interim` so the UI can
 * ghost it in pencil.
 *
 * Honesty note for calling UIs: the Web Speech API may send audio to the
 * browser vendor's speech service — surface that to the user in plain words.
 */

export const DICTATION_LANGUAGES: { code: string; label: string }[] = [
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "pt-BR", label: "Português (BR)" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "ar-SA", label: "العربية" },
];

// Shared with InnerMate's voice input — one language choice for the whole app.
const LANG_STORAGE_KEY = "qc.voiceLang";

export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [lang, setLangState] = useState("en-IN");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // Restore the saved language, else follow the device (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && DICTATION_LANGUAGES.some((l) => l.code === saved)) {
      setLangState(saved);
      return;
    }
    const nav = window.navigator?.language;
    const match =
      DICTATION_LANGUAGES.find((l) => l.code === nav) ||
      DICTATION_LANGUAGES.find((l) => nav?.startsWith(l.code.split("-")[0]));
    if (match) setLangState(match.code);
  }, []);

  // (Re)build the recognizer whenever the language changes; the cleanup stops
  // any in-flight session first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText.trim()) onFinalRef.current(finalText.trim());
      setInterim(interimText);
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    rec.onerror = (ev: any) => {
      setListening(false);
      setInterim("");
      if (ev?.error && ev.error !== "no-speech" && ev.error !== "aborted") {
        setError(ev.error === "not-allowed"
          ? "microphone permission was declined — voice writing needs it."
          : "couldn't hear you — try again.");
      }
    };
    recognitionRef.current = rec;
    return () => {
      recognitionRef.current = null;
      try { rec.stop(); } catch { /* noop */ }
      // A language change mid-session must not leave the UI claiming to
      // listen against a recognizer that no longer exists.
      setListening(false);
      setInterim("");
    };
  }, [lang]);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    try { window.localStorage.setItem(LANG_STORAGE_KEY, code); } catch { /* noop */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim("");
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) { stop(); return; }
    setError(null);
    setInterim("");
    try { rec.start(); setListening(true); } catch { /* already started */ }
  }, [listening, stop]);

  return { supported, listening, interim, lang, setLang, toggle, stop, error };
}
