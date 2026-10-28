// Run: node tests/engine.test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.split("/* ===== ENGINE START")[1].split("/* ===== ENGINE END")[0];
const Engine = new Function(src.slice(src.indexOf("\n")) + "\nreturn Engine;")();
const json = JSON.parse(html.split('<script id="pilot-results" type="application/json">')[1].split("</script>")[0]);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", n, name); };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

/* distributions */
t("confirmed date puts all mass on one week", () => {
  const p = Engine.distribution({ kind: "confirmed", week: 4 });
  close(p.reduce((a, b) => a + b, 0), 1); close(p[4], 1);
  const s = Engine.stats(p); close(s.mean, 4); close(s.sd, 0);
});
t("range is uniform and sums to one", () => {
  const p = Engine.distribution({ kind: "range", from: 3, to: 9 });
  close(p.reduce((a, b) => a + b, 0), 1); close(p[3], 1 / 7); close(p[2], 0);
  const s = Engine.stats(p); close(s.mean, 6); close(s.sd, 2, 1e-12);
});
t("chance by week", () => {
  const p = Engine.distribution({ kind: "range", from: 3, to: 9 });
  close(Engine.chanceBy(p, 5), 3 / 7); close(Engine.chanceBy(p, 2), 0); close(Engine.chanceBy(p, 20), 1);
});

/* waiting-list tracker */
t("chance in next 2 weeks updates as time passes", () => {
  const p = Engine.distribution({ kind: "range", from: 3, to: 9 });
  close(Engine.chanceNext(p, 0, 2), 0);          // weeks 1 and 2 are before the range
  close(Engine.chanceNext(p, 2, 2), 2 / 7);      // weeks 3,4 of 3..9
  close(Engine.chanceNext(p, 5, 2), 2 / 4);      // weeks 6,7 of 6..9
  close(Engine.chanceNext(p, 8, 2), 1);          // only week 9 left
  assert.equal(Engine.chanceNext(p, 9, 2), null); // range has passed
});
t("remaining distribution renormalises", () => {
  const r = Engine.remaining(Engine.distribution({ kind: "range", from: 3, to: 9 }), 5);
  close(r.reduce((a, b) => a + b, 0), 1); close(r[6], 0.25); close(r[5], 0);
});
t("elapsed counts whole days and weeks", () => {
  const e = Engine.elapsed("2026-10-01", "2026-10-28");
  assert.equal(e.days, 27); assert.equal(e.weeks, 3);
  assert.equal(Engine.elapsed("2026-10-28", "2026-10-01").days, 0);
});
t("wait stages move from early to overdue", () => {
  const entry = { kind: "range", from: 4, to: 8, joined: "2026-09-01" };
  assert.equal(Engine.waitStage(entry, "2026-09-03").stage, "early");
  assert.equal(Engine.waitStage(entry, "2026-09-17").stage, "middle");
  assert.equal(Engine.waitStage(entry, "2026-10-06").stage, "window");
  assert.equal(Engine.waitStage(entry, "2026-11-10").stage, "overdue");
});

/* costs */
t("Medicare gap for a psychologist", () => {
  const r = Engine.costPlan({ fee: 200, type: "psychologist", sessions: 6, usedThisYear: 0 });
  close(r.rebate, 101.55); close(r.medicareGap, 98.45); close(r.total, 590.70, 1e-6); close(r.saved, 609.30, 1e-6);
});
t("bulk billing costs nothing", () => {
  const r = Engine.costPlan({ fee: 200, type: "clinical", bulkBilled: true, sessions: 10, usedThisYear: 0 });
  close(r.total, 0);
});
t("fee below rebate never gives a negative cost", () => {
  close(Engine.costPlan({ fee: 80, type: "clinical", sessions: 3 }).total, 0);
});
t("Medicare stops at 10 sessions, extras pay after", () => {
  const r = Engine.costPlan({ fee: 200, type: "psychologist", sessions: 6, usedThisYear: 7,
    extras: { on: true, perSession: 60, annualLimit: 100 } });
  assert.equal(r.medicareSessions, 3);
  assert.equal(r.extrasSessions, 2);      // $60 then $40 left in limit
  assert.equal(r.fullSessions, 1);
  close(r.extrasPaid, 100);
  close(r.total, 3 * 98.45 + (200 - 60) + (200 - 40) + 200, 1e-6);
});
t("no GP plan means no rebate", () => {
  const r = Engine.costPlan({ fee: 200, type: "psychologist", sessions: 4, hasPlan: false });
  close(r.total, 800); assert.equal(r.medicareSessions, 0);
});
t("extras only total for comparison", () => {
  const r = Engine.costPlan({ fee: 200, type: "psychologist", sessions: 4, extras: { on: true, perSession: 80, annualLimit: 200 } });
  close(r.totalExtrasOnly, 120 + 120 + 160 + 200);
});

/* matching */
const svc = { ages: [12, 25], areas: ["newcastle"], modes: ["inperson"], cost: "free", referral: "none" };
t("unknown answers never exclude a service", () => {
  assert.equal(Engine.matchService(svc, {}).ok, true);
});
t("age, area and mode exclude with reasons", () => {
  const m = Engine.matchService(svc, { age: "26plus", area: "maitland", mode: "online" });
  assert.equal(m.ok, false); assert.equal(m.not.length, 3);
});
t("student-only service", () => {
  const s = { students: true };
  assert.equal(Engine.matchService(s, { student: "no" }).ok, false);
  assert.equal(Engine.matchService(s, { student: "yes" }).ok, true);
});
t("hardship service shown unless person says cost is not a problem", () => {
  const s = { hardship: true };
  assert.equal(Engine.matchService(s, {}).ok, true);
  assert.equal(Engine.matchService(s, { hardship: "no" }).ok, false);
});
t("sorting by cost puts free first", () => {
  const a = { cost: "free", startToday: false }, b = { cost: "medicare", startToday: true };
  assert.ok(Engine.rankScore(a, {}, "cost") < Engine.rankScore(b, {}, "cost"));
  assert.ok(Engine.rankScore(b, {}, "soon") < Engine.rankScore(a, {}, "soon"));
});

/* clinic statements */
t("quantiles match NumPy type 7", () => {
  const xs = [1, 2, 3, 4, 10];
  close(Engine.quantile(xs, 0.5), 3); close(Engine.quantile(xs, 0.8), 5.2);
});
t("clinic statements round up and fit an SMS", () => {
  const st = Engine.clinicStatements([1.2, 2, 3.4, 4, 5, 6.1, 7, 8, 9, 12], "Test Clinic");
  assert.equal(st.q50, 6); assert.ok(st.q90 >= st.q80 && st.q80 >= st.q50);
  assert.ok(st.sms.length <= 160, st.sms.length);
  assert.ok(st.web.includes("Test Clinic"));
  const long = Engine.clinicStatements([1, 2, 3, 4, 5], "A Very Long Name Psychology and Counselling Clinic of the Hunter Region");
  assert.ok(long.sms.length <= 160, long.sms.length);
});
t("natural frequency phrases", () => {
  assert.equal(Engine.inTen(0.42), "about 4 in 10"); assert.equal(Engine.inTen(1), "all 10 in 10");
});
t("parse numbers ignores junk", () => { assert.deepEqual(Engine.parseNumbers("12, 15;x\n-3 20"), [12, 15, 20]); });


/* personal trade-offs (choice game) */
const PRI = { wait: { mu: -0.2, sd: 0.1 }, spread: { mu: -0.26, sd: 0.13 }, cost: { mu: -0.0138, sd: 0.0069 }, video: { mu: -0.35, sd: 0.17 } };
const TASKS = [
  [{ kind: "confirmed", week: 6, cost: 0 }, { kind: "range", from: 2, to: 10, cost: 0 }],
  [{ kind: "confirmed", week: 8, cost: 0 }, { kind: "range", from: 3, to: 7, cost: 0 }],
  [{ kind: "confirmed", week: 4, cost: 120 }, { kind: "range", from: 2, to: 8, cost: 40 }]
];
t("attributes match the study coding", () => {
  assert.deepEqual(Engine.attrs({ kind: "range", from: 3, to: 9, cost: 40, mode: "video" }), { mean: 6, half: 3, cost: 40, video: 1 });
  assert.deepEqual(Engine.attrs({ kind: "confirmed", week: 4, cost: 0 }), { mean: 4, half: 0, cost: 0, video: 0 });
});
t("draws are repeatable and keep cost negative", () => {
  const a = Engine.draws(PRI, 500, 1), b = Engine.draws(PRI, 500, 1);
  assert.deepEqual(a[10], b[10]); assert.ok(a.every(d => d.cost < 0 && d.wait < 0));
});
t("no answers gives back the starting point", () => {
  const ds = Engine.draws(PRI, 4000, 3), m = Engine.posterior(ds, []).mean;
  close(m.spread, -0.26, 0.01); close(m.cost, -0.0138, 0.0005);
});
t("always choosing the set date raises the value of certainty", () => {
  const ds = Engine.draws(PRI, 4000, 5);
  const base = Engine.values(Engine.posterior(ds, []).mean).certainty;
  const sure = Engine.values(Engine.posterior(ds, TASKS.map(([a, b]) => ({ a: Engine.attrs(a), b: Engine.attrs(b), pick: 0 }))).mean).certainty;
  const flex = Engine.values(Engine.posterior(ds, TASKS.map(([a, b]) => ({ a: Engine.attrs(a), b: Engine.attrs(b), pick: 1 }))).mean).certainty;
  assert.ok(sure > base && base > flex, `${sure} ${base} ${flex}`);
});
t("values are the study's trade-offs", () => {
  const v = Engine.values({ wait: -0.2, spread: -0.25, cost: -0.0125, video: -0.3 });
  close(v.certainty, 60); close(v.weeksFor50, 3.125); close(v.faceToFace, 24);
});
t("percentile is between 0 and 1 and ordered", () => {
  const ds = Engine.draws(PRI, 2000, 9);
  const lo = Engine.percentile(ds, "certainty", 10), hi = Engine.percentile(ds, "certainty", 150);
  assert.ok(lo >= 0 && hi <= 1 && lo < hi);
});
t("rank prefers the cheaper option when all else is equal", () => {
  const sh = Engine.rank({ wait: -0.2, spread: -0.25, cost: -0.0125, video: -0.3 }, [{ kind: "range", from: 3, to: 6, cost: 0 }, { kind: "range", from: 3, to: 6, cost: 100 }]);
  close(sh[0] + sh[1], 1); assert.ok(sh[0] > sh[1]);
});
t("quick check always includes the right answer", () => {
  for (const p of [0, 0.1, 0.43, 0.5, 0.86, 1]) { const q = Engine.quizChoices(p); assert.ok(q.options.includes(q.correct)); assert.ok(q.options.length >= 2); }
});

/* page */
t("embedded pilot results are flagged as simulated", () => {
  assert.equal(json.meta.simulated, true);
  assert.ok(json.values.dollars_per_session_confirmed_vs_pm3.est > 0);
});
t("page text has no em or en dashes", () => { assert.ok(!/[–—]/.test(html)); });
t("crisis numbers are present", () => {
  for (const num of ["000", "1800 011 511", "13 11 14", "1300 659 467", "13 92 76", "1800 55 1800", "1800 595 212"]) assert.ok(html.includes(num), num);
});
console.log(`\n${n} tests passed`);
