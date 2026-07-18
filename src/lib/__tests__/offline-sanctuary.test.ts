import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { crisisResourcesFor, crisisDirectoryFor } from "../crisis-resources.ts";

/**
 * The lamp that stays lit — contract tests for the offline sanctuary.
 * offline.html is static, so these tests are what binds it to the
 * crisis-resources config: change one without the other and the gate fails.
 * The same binding covers every route file: no screen may carry a helpline
 * number the config doesn't know about.
 */

const offlineHtml = readFileSync("public/offline.html", "utf-8");
const swJs = readFileSync("public/sw.js", "utf-8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf-8"));

describe("offline page: crisis numbers", () => {
  it("carries exactly the configured IN numbers as tel: links", () => {
    const telHrefs = [...offlineHtml.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
    const configured = crisisResourcesFor("IN").map((r) => r.phone);
    assert.deepEqual([...telHrefs].sort(), [...configured].sort());
  });

  it("names every configured helpline", () => {
    for (const r of crisisResourcesFor("IN")) {
      if (r.name === "Emergency") continue; // rendered bilingually, checked below
      assert.ok(offlineHtml.includes(r.name), `missing ${r.name}`);
    }
    assert.ok(offlineHtml.includes("Emergency"));
  });

  it("contains no other phone-number-looking tel links", () => {
    const telCount = (offlineHtml.match(/href="tel:/g) ?? []).length;
    assert.equal(telCount, crisisResourcesFor("IN").length);
  });
});

describe("routes: crisis numbers stay bound to the config", () => {
  const digitsOf = (s: string) => s.replace(/\D/g, "");
  const allowed = new Set(
    crisisDirectoryFor("IN").flatMap((r) =>
      r.altPhone ? [digitsOf(r.phone), digitsOf(r.altPhone)] : [digitsOf(r.phone)],
    ),
  );

  const routeFiles = (function collect(dir: string): { file: string; source: string }[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) return collect(p);
      return /\.tsx?$/.test(entry.name) ? [{ file: p, source: readFileSync(p, "utf-8") }] : [];
    });
  })("src/routes");

  it("reads every route file", () => {
    assert.ok(routeFiles.length >= 20, "route scan came back suspiciously empty");
  });

  it("every tel: link dials a configured number", () => {
    for (const { file, source } of routeFiles) {
      for (const m of source.matchAll(/tel:([\d+\- ]+)/g)) {
        assert.ok(allowed.has(digitsOf(m[1])), `${file} dials unconfigured ${m[1]}`);
      }
    }
  });

  it("no route hardcodes a helpline number that isn't in the config", () => {
    // Helpline shapes: 1-800 toll-free long forms and 14xxx/15xxx short codes.
    const helplineLike = /\b1[-\s]?800[-\s]?\d{3}[-\s]?\d{4}\b|\b1[45]\d{3}\b/g;
    for (const { file, source } of routeFiles) {
      for (const m of source.matchAll(helplineLike)) {
        assert.ok(
          allowed.has(digitsOf(m[0])),
          `${file} hardcodes ${m[0]} — helplines live only in crisis-resources.ts`,
        );
      }
    }
  });
});

describe("offline page: self-containment and care", () => {
  it("makes no external requests", () => {
    assert.equal(/https?:\/\//.test(offlineHtml), false);
  });

  it("speaks Hindi too", () => {
    assert.ok(offlineHtml.includes('lang="hi"'));
    assert.ok(/[ऀ-ॿ]/.test(offlineHtml));
  });

  it("respects reduced motion", () => {
    assert.ok(offlineHtml.includes("prefers-reduced-motion"));
  });

  it("keeps the 4-in 6-out breath of the app's pacer", () => {
    assert.ok(offlineHtml.includes("in 4"));
    assert.ok(offlineHtml.includes("out 6"));
    // 40% of the 10s cycle is the 4s inhale peak, as in .qs-pacer
    assert.ok(offlineHtml.includes("40%"));
  });
});

describe("service worker: safety rails", () => {
  it("never touches non-GET requests", () => {
    assert.ok(swJs.includes('req.method !== "GET"'));
  });

  it("never leaves this origin", () => {
    assert.ok(swJs.includes("url.origin !== self.location.origin"));
  });

  it("stores only allowlisted, personal-data-free pages", () => {
    const m = swJs.match(/PAGE_ALLOWLIST = (\[[^\]]*\])/);
    assert.ok(m, "allowlist missing");
    const list = m![1];
    for (const safe of ['"/"', '"/login"', '"/sos"']) assert.ok(list.includes(safe));
    for (const priv of ["journal", "memories", "home", "you", "insights", "companion"]) {
      assert.equal(list.includes(priv), false, `${priv} must never be cached`);
    }
    assert.ok(swJs.includes("PAGE_ALLOWLIST.includes(url.pathname)"));
  });

  it("pre-caches the offline page and cleans old cache versions", () => {
    assert.ok(swJs.includes('OFFLINE_URL = "/offline.html"'));
    assert.ok(swJs.includes("cache.addAll([OFFLINE_URL])"));
    assert.ok(swJs.includes("k.startsWith(VERSION)"));
  });
});

describe("the sanctuary stays reachable offline", () => {
  const offlineTs = readFileSync("src/lib/offline.ts", "utf-8");
  const appLayout = readFileSync("src/routes/_app.tsx", "utf-8");
  const sosRoute = readFileSync("src/routes/_app.sos.tsx", "utf-8");

  it("warms only pages the worker is allowed to store", () => {
    const m = offlineTs.match(/urls: \[([^\]]*)\]/);
    assert.ok(m, "warm url list missing");
    const warmed = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    assert.ok(warmed.length >= 2, "must warm /sos and the offline fallback");
    const allow = swJs.match(/PAGE_ALLOWLIST = \[[^\]]*\]/)![0];
    for (const u of warmed) assert.ok(allow.includes(`"${u}"`) || (u === "/offline.html" && allow.includes("OFFLINE_URL")), `${u} not allowlisted`);
  });

  it("waits for an active worker before warming (first-visit race)", () => {
    assert.ok(offlineTs.includes("navigator.serviceWorker.ready"));
  });

  it("refreshes the fallback on every warm, never pinning stale numbers", () => {
    assert.ok(offlineTs.includes('"/offline.html"'));
    assert.ok(swJs.includes('cache: "no-cache"'));
  });

  it("keeps /sos free of data dependencies and the auth gate", () => {
    assert.equal(/beforeLoad|loader:/.test(sosRoute), false, "/sos must not gain a loader");
    assert.equal(/useQuery|useServerFn/.test(sosRoute), false, "/sos must not fetch data");
    assert.ok(appLayout.includes("isSanctuary"), "the sanctuary bypass must exist in _app.tsx");
    assert.ok(appLayout.includes("!ready && !isSanctuary"), "the sanctuary must skip the auth spinner");
    const authFetch = appLayout.match(/const \{ data: p, error \}/);
    assert.ok(authFetch, "profile fetch must distinguish error from missing row");
  });

  it("caps the assets cache so deploys cannot grow it forever", () => {
    assert.ok(swJs.includes("ASSETS_CAP"));
    assert.ok(swJs.includes("trimAssets"));
  });
});

describe("web manifest", () => {
  it("is installable and stays in the world", () => {
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.theme_color, "#0e121e");
  });

  it("ships every icon it declares", () => {
    assert.ok(manifest.icons.length >= 3);
    for (const icon of manifest.icons) {
      assert.ok(existsSync(`public${icon.src}`), `missing ${icon.src}`);
    }
    assert.ok(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable"));
  });
});
