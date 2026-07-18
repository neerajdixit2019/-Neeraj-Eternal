import type { jsPDF } from "jspdf";
import { NOTO_DEVANAGARI_B64 } from "./noto-devanagari.ts";

/**
 * Shared Hindi support for every jsPDF document the app produces.
 *
 * jsPDF's built-in fonts carry no Devanagari glyphs, so a subset Noto Sans
 * Devanagari rides along whenever a document needs it. jsPDF still has no
 * Indic shaping — matras can sit slightly off — which is why the UI offers
 * the browser-typeset "fair copy" for print-perfect Hindi, and why every
 * surface that ships a Devanagari PDF says so honestly.
 */

export const DEVANAGARI = /[ऀ-ॿ]/;

export function anyDevanagari(texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && DEVANAGARI.test(t));
}

/**
 * Register the subset font on a document (when needed) and return the
 * per-line font chooser: Devanagari lines use the one embedded weight,
 * everything else keeps its Times style.
 */
export function devanagariFontFor(doc: jsPDF, needed: boolean) {
  if (needed) {
    doc.addFileToVFS("NotoDevanagari.ttf", NOTO_DEVANAGARI_B64);
    doc.addFont("NotoDevanagari.ttf", "NotoDevanagari", "normal");
  }
  return (text: string, style: "normal" | "italic" | "bold") => {
    if (needed && DEVANAGARI.test(text)) {
      doc.setFont("NotoDevanagari", "normal");
    } else {
      doc.setFont("times", style);
    }
  };
}
