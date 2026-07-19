import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 32 — bilingual QA hardening. A Hindi reader must not see Hindi chrome
 * wrapped around English-formatted dates/times. Every user-facing
 * `toLocale*String` in a route or component must be locale-AWARE: it either
 * passes a `"hi-IN"`/lang-derived locale, or a `locale` variable computed from
 * lang — never a bare `undefined` locale (which silently uses the runtime
 * default and shows English months to Hindi users).
 *
 * Excluded on purpose: `src/components/ui/**` (vendored primitives) and
 * `src/routes/api/**` (server-side; the AI prompt context is English by design).
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (p.replace(/\\/g, "/").includes("/components/ui")) continue;
      if (p.replace(/\\/g, "/").includes("/routes/api")) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

const userFacing = [
  ...walk("src/routes"),
  ...walk("src/components"),
];

const BARE_UNDEFINED_LOCALE = /toLocale(?:Date|Time)?String\(\s*undefined/;

describe("locale: user-facing dates/times are locale-aware", () => {
  it("no route or component formats a date/time with a bare `undefined` locale", () => {
    const offenders: string[] = [];
    for (const f of userFacing) {
      const src = readFileSync(f, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (BARE_UNDEFINED_LOCALE.test(line)) {
          offenders.push(`${f.replace(/\\/g, "/")}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    assert.deepEqual(
      offenders,
      [],
      `these date/time renders ignore the reader's language (use \`lang === "hi" ? "hi-IN" : undefined\`):\n` +
        offenders.join("\n"),
    );
  });

  it("the routes we localized reference the Hindi locale", () => {
    for (const f of [
      "src/routes/_app.insights.tsx",
      "src/routes/_app.journal.tsx",
      "src/routes/_app.trusted-letter.tsx",
    ]) {
      const src = readFileSync(f, "utf-8");
      assert.ok(src.includes("hi-IN"), `${f} should localize its dates for Hindi`);
    }
  });
});
