// Run: node tests/engine.test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.split("/* ===== ENGINE START")[1].split("/* ===== ENGINE END")[0];
const Engine = new Function(src.slice(src.indexOf("\n")) + "\nreturn Engine;")();
const json = JSON.parse(html.split('<script id="pilot-results" type="application/json">')[1].split("</script>")[0]);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", n, name); };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

t("confirmed date puts all mass on one week", () => {
  const p = Engine.distribution({ kind: "confirmed", week: 4 });
  close(p.reduce((a, b) => a + b, 0), 1); close(p[4], 1);
  const s = Engine.stats(p); close(s.mean, 4); close(s.sd, 0);
});
t("range is uniform and sums to one", () => {
  const p = Engine.distribution({ kind: "range", from: 3, to: 9 });
  close(p.reduce((a, b) => a + b, 0), 1); close(p[3], 1 / 7); close(p[2], 0);
  const s = Engine.stats(p); close(s.mean, 6); close(s.sd, 2, 1e-12); // sd of uniform 3..9 = 2
  assert.equal(s.earliest, 3); assert.equal(s.latest, 9);
});
t("reversed range is handled", () => { close(Engine.stats(Engine.distribution({ kind: "range", from: 9, to: 3 })).mean, 6); });
t("chance by deadline", () => {
  const p = Engine.distribution({ kind: "range", from: 3, to: 9 });
  close(Engine.chanceBy(p, 5), 3 / 7); close(Engine.chanceBy(p, 2), 0); close(Engine.chanceBy(p, 20), 1);
});
t("utility uses mean, sd, cost and mode", () => {
  const coef = { wait: -0.2, spread: -0.25, cost: -0.01, video: -0.3 };
  const u = Engine.utility({ kind: "range", from: 3, to: 9, cost: 50, mode: "video" }, coef);
  close(u, -0.2 * 6 - 0.25 * 2 - 0.5 - 0.3);
  const u0 = Engine.utility({ kind: "range", from: 3, to: 9, cost: 50, mode: "video" }, coef, { certainty: 0 });
  close(u0, -0.2 * 6 - 0.5 - 0.3);
});
t("shares sum to one and order by utility", () => {
  const s = Engine.shares([-1, -2, -1.5]); close(s.reduce((a, b) => a + b, 0), 1);
  assert.ok(s[0] > s[2] && s[2] > s[1]);
  const big = Engine.shares([-1000, -1001]); close(big.reduce((a, b) => a + b, 0), 1);
});
t("tested range flag", () => {
  assert.equal(Engine.inTestedRange({ kind: "range", from: 3, to: 9, cost: 0 }), true);
  assert.equal(Engine.inTestedRange({ kind: "confirmed", week: 2, cost: 0 }), false);
  assert.equal(Engine.inTestedRange({ kind: "range", from: 4, to: 8, cost: 150 }), false);
});
t("quantiles match NumPy type 7", () => {
  const xs = [1, 2, 3, 4, 10];
  close(Engine.quantile(xs, 0.5), 3); close(Engine.quantile(xs, 0.8), 5.2); close(Engine.quantile([5], 0.9), 5);
});
t("parse numbers ignores junk", () => { assert.deepEqual(Engine.parseNumbers("12, 15;x\n-3 20"), [12, 15, 20]); });
t("natural frequency phrases", () => {
  assert.equal(Engine.inTen(0.42), "about 4 in 10"); assert.equal(Engine.inTen(1), "all 10 in 10");
  assert.equal(Engine.inTen(0.02), "fewer than 1 in 10"); assert.equal(Engine.inTen(0), "none (0 in 10)");
});
t("describe has no dashes", () => {
  const d = Engine.describe({ kind: "range", from: 3, to: 9 }, 5) + Engine.describe({ kind: "confirmed", week: 4 }, 5);
  assert.ok(!/[–—]/.test(d));
});
t("embedded results are flagged as simulated and complete", () => {
  assert.equal(json.meta.simulated, true);
  for (const k of ["wait", "spread", "cost", "video"]) assert.ok(json.main_model.coefs.find(c => c.name === k));
  assert.ok(json.values.dollars_per_session_confirmed_vs_pm3.est > 0);
  assert.ok(json.eye_tracking.attention_choice_model.coefs.length === 5);
});
t("page text has no em or en dashes", () => { assert.ok(!/[–—]/.test(html)); });
console.log(`\n${n} tests passed`);
