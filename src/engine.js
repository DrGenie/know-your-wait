/* ===== ENGINE START (pure functions; tested in tests/engine.test.mjs) ===== */
const Engine = (() => {
  const MAX_WEEK = 52;

  /* ---------- Medicare rules (Better Access), checked 28 October 2026 ---------- */
  // Medicare benefit for a session of 50 minutes or more, from 1 July 2026.
  // Psychologist: MBS item 80110, schedule fee $119.45, benefit $101.55 (MBS Online).
  // Clinical psychologist (item 80010) and mental health social worker or OT: published 2026-27 benefits.
  const REBATE = { psychologist: 101.55, clinical: 149.05, socialworker: 89.50 };
  const MEDICARE_SESSIONS_PER_YEAR = 10;

  function round2(x) { return Math.round(x * 100) / 100; }
  function clampInt(x, lo, hi) {
    x = Math.round(Number(x));
    if (!Number.isFinite(x)) x = lo;
    return Math.min(hi, Math.max(lo, x));
  }

  /* ---------- Waiting-time distributions ---------- */
  /** Week-by-week probability of being seen. opt.kind is "confirmed" or "range". */
  function distribution(opt) {
    const p = new Array(MAX_WEEK + 1).fill(0);
    if (opt.kind === "confirmed") {
      p[clampInt(opt.week, 0, MAX_WEEK)] = 1;
      return p;
    }
    let a = clampInt(opt.from, 0, MAX_WEEK), b = clampInt(opt.to, 0, MAX_WEEK);
    if (a > b) [a, b] = [b, a];
    const n = b - a + 1;
    for (let w = a; w <= b; w++) p[w] = 1 / n;
    return p;
  }

  function stats(p) {
    let mean = 0, first = -1, last = -1;
    p.forEach((q, w) => { mean += q * w; if (q > 0) { if (first < 0) first = w; last = w; } });
    let v = 0;
    p.forEach((q, w) => { v += q * (w - mean) ** 2; });
    return { mean, sd: Math.sqrt(v), earliest: first, latest: last };
  }

  function chanceBy(p, week) {
    let s = 0;
    for (let w = 0; w <= Math.min(week, p.length - 1); w++) s += p[w];
    return Math.min(1, s);
  }

  /**
   * Chance of being seen within the next `horizon` weeks, given you have
   * already waited `waited` whole weeks and have not yet been seen.
   * Returns null when the quoted range has already passed.
   */
  function chanceNext(p, waited, horizon) {
    let left = 0, soon = 0;
    for (let w = 0; w < p.length; w++) {
      if (w > waited) { left += p[w]; if (w <= waited + horizon) soon += p[w]; }
    }
    if (left <= 1e-12) return null;
    return soon / left;
  }

  /** Remaining distribution after waiting `waited` weeks (renormalised). */
  function remaining(p, waited) {
    const out = p.map((q, w) => (w > waited ? q : 0));
    const s = out.reduce((a, b) => a + b, 0);
    return s > 0 ? out.map(q => q / s) : out;
  }

  /** Whole weeks and days between two dates (ISO strings or Date). */
  function elapsed(fromDate, toDate) {
    const a = new Date(fromDate), b = new Date(toDate);
    const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const days = Math.max(0, Math.round(ms / 86400000));
    return { days, weeks: Math.floor(days / 7) };
  }

  /** Stage of a waiting-list entry and the advice that goes with it. */
  function waitStage(entry, today) {
    const { days, weeks } = elapsed(entry.joined, today);
    const p = distribution(entry);
    const st = stats(p);
    const next2 = chanceNext(p, weeks, 2);
    let stage;
    if (weeks > st.latest) stage = "overdue";
    else if (weeks >= st.earliest) stage = "window";
    else if (weeks >= Math.max(1, Math.floor(st.earliest / 2))) stage = "middle";
    else stage = "early";
    const pctThrough = st.latest > 0 ? Math.min(1, days / (7 * st.latest)) : 1;
    return { days, weeks, stage, next2, earliest: st.earliest, latest: st.latest, pctThrough };
  }

  /* ---------- Costs ---------- */
  /**
   * Out-of-pocket cost for a course of sessions.
   * a = { fee, type, bulkBilled, sessions, usedThisYear, extras: { on, perSession, annualLimit } }
   * Rules: Medicare covers up to 10 sessions a calendar year with a GP plan;
   * private health extras cannot top up a Medicare session, but can be used for
   * sessions Medicare does not cover.
   */
  function costPlan(a) {
    const fee = Math.max(0, Number(a.fee) || 0);
    const sessions = clampInt(a.sessions, 0, 52);
    const used = clampInt(a.usedThisYear, 0, MEDICARE_SESSIONS_PER_YEAR);
    const rebate = a.hasPlan === false ? 0 : (REBATE[a.type] || REBATE.psychologist);
    const medicareGap = a.bulkBilled ? 0 : Math.max(0, fee - rebate);
    const medicareLeft = a.hasPlan === false ? 0 : MEDICARE_SESSIONS_PER_YEAR - used;
    const ex = a.extras || {};
    const exOn = !!ex.on;
    const exPer = exOn ? Math.max(0, Number(ex.perSession) || 0) : 0;
    const exLimit = exOn ? Math.max(0, Number(ex.annualLimit) || 0) : 0;

    // Medicare first, then extras, then pay in full.
    let mSessions = Math.min(sessions, medicareLeft);
    let rest = sessions - mSessions;
    let limitLeft = exLimit, exSessions = 0, exPaid = 0, fullSessions = 0, restCost = 0;
    for (let i = 0; i < rest; i++) {
      const pay = Math.min(exPer, fee, limitLeft);
      if (pay > 0) { exSessions++; exPaid += pay; limitLeft -= pay; restCost += fee - pay; }
      else { fullSessions++; restCost += fee; }
    }
    const medicareFirst = round2(mSessions * medicareGap + restCost);

    // Extras only (no Medicare), for comparison.
    limitLeft = exLimit; let exOnly = 0;
    for (let i = 0; i < sessions; i++) { const pay = Math.min(exPer, fee, limitLeft); limitLeft -= pay; exOnly += fee - pay; }

    return {
      fee, rebate, medicareGap: round2(medicareGap), medicareLeft,
      medicareSessions: mSessions, extrasSessions: exSessions, extrasPaid: round2(exPaid), fullSessions,
      total: medicareFirst,
      totalNoHelp: round2(sessions * fee),
      totalExtrasOnly: round2(exOnly),
      saved: round2(sessions * fee - medicareFirst)
    };
  }

  /* ---------- Matching services to a person ---------- */
  const AGE_BANDS = { u12: [0, 11], "12to15": [12, 15], "16to17": [16, 17], "18to25": [18, 25], "26plus": [26, 120] };

  /**
   * Check a service against a profile. Unknown answers never exclude a service.
   * Returns { ok, why: [...reasons it fits], not: [...reasons it does not] }.
   */
  function matchService(s, prof) {
    const why = [], not = [];
    const band = AGE_BANDS[prof.age];
    if (band && s.ages) {
      if (band[1] < s.ages[0] || band[0] > s.ages[1]) not.push(s.ages[1] >= 120 ? `For people aged ${s.ages[0]} and over` : `For ages ${s.ages[0]} to ${s.ages[1]}`);
      else if (s.ages[0] > 0 || s.ages[1] < 120) why.push(`Right for your age`);
    }
    if (s.students && prof.student !== "yes") not.push("Only for University of Newcastle students");
    if (s.students && prof.student === "yes") why.push("Free for UON students");
    if (s.areas && prof.area && prof.area !== "other" && !s.areas.includes(prof.area)) not.push("Not in your area");
    if (s.areas && prof.area && s.areas.includes(prof.area)) why.push("Close to you");
    if (s.hardship && prof.hardship === "no") not.push("For people who find it hard to pay");
    if (s.hardship && prof.hardship === "yes") why.push("For people who find it hard to pay");
    if (prof.mode && prof.mode !== "any" && s.modes && !s.modes.includes(prof.mode)) not.push(`Does not offer ${({ inperson: "face to face", phone: "phone or video", online: "online" })[prof.mode]} support`);
    if (prof.mode && prof.mode !== "any" && s.modes && s.modes.includes(prof.mode)) why.push(({ inperson: "Face to face", phone: "Phone or video", online: "Online, at your own pace" })[prof.mode]);
    if (s.cost === "free") why.push("No cost");
    if (s.referral === "none") why.push("No referral needed");
    if (s.startToday) why.push("You can start today");
    return { ok: not.length === 0, why, not };
  }

  /** Sort key. Lower is better. */
  function rankScore(s, prof, sortBy) {
    const costRank = { free: 0, low: 1, medicare: 2 }[s.cost] ?? 3;
    const soonRank = s.startToday ? 0 : s.referral === "none" ? 1 : 2;
    const special = (s.students && prof.student === "yes") || (s.youth && ["12to15", "16to17", "18to25"].includes(prof.age)) || (s.hardship && prof.hardship === "yes") || (s.areas && s.areas.includes(prof.area));
    const modeHit = prof.mode && prof.mode !== "any" && s.modes && s.modes.includes(prof.mode) ? 0 : 1;
    if (sortBy === "cost") return costRank * 100 + soonRank * 10 + modeHit;
    if (sortBy === "soon") return soonRank * 100 + costRank * 10 + modeHit;
    return (special ? 0 : 1) * 1000 + modeHit * 100 + soonRank * 10 + costRank;
  }

  /* ---------- Clinic statements ---------- */
  function parseNumbers(text) {
    return String(text || "").split(/[\s,;]+/).map(Number).filter(x => Number.isFinite(x) && x >= 0);
  }
  /** Empirical quantile (type 7, as in R and NumPy default). */
  function quantile(xs, q) {
    if (!xs.length) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    const h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  function shareWithin(xs, limit) {
    if (!xs.length) return NaN;
    return xs.filter(x => x <= limit + 1e-9).length / xs.length;
  }
  /** Natural frequency phrase, e.g. 0.42 -> "about 4 in 10". */
  function inTen(prob) {
    if (prob >= 0.995) return "all 10 in 10";
    if (prob <= 0.005) return "none (0 in 10)";
    const k = Math.round(prob * 10);
    if (k === 0) return "fewer than 1 in 10";
    if (k === 10) return "almost all (10 in 10)";
    return "about " + k + " in 10";
  }
  /** Waiting-list statements for clinics. waits are in weeks. */
  function clinicStatements(waits, serviceName) {
    const r = x => Math.max(1, Math.ceil(x));
    const n = waits.length;
    const q50 = r(quantile(waits, 0.5)), q80 = r(quantile(waits, 0.8)), q90 = r(quantile(waits, 0.9));
    const name = (serviceName || "").trim() || "our service";
    const web = `Waiting times at ${name}: half of new clients have their first appointment within ${q50} weeks, 8 in 10 within ${q80} weeks and 9 in 10 within ${q90} weeks. This is based on our last ${n} new clients.`;
    let sms = `${name}: most new clients are seen in ${q50} to ${q90} weeks. We will call with a date. Help sooner: 1800 595 212. Emergency: 000`;
    if (sms.length > 160) sms = `Most new clients are seen in ${q50} to ${q90} weeks. We will call with a date. Help sooner: 1800 595 212. Emergency: 000`;
    return { n, q50, q80, q90, web, sms };
  }

  function fmt1(x) { return (Math.round(x * 10) / 10).toString(); }

  /* ---------- Choice model (pilot) ---------- */
  function utility(opt, coef, weights) {
    const st = stats(distribution(opt));
    const w = Object.assign({ wait: 1, certainty: 1, cost: 1, mode: 1 }, weights || {});
    return coef.wait * st.mean * w.wait + coef.spread * st.sd * w.certainty
      + coef.cost * Number(opt.cost || 0) * w.cost + coef.video * (opt.mode === "video" ? 1 : 0) * w.mode;
  }
  function shares(utils) {
    const m = Math.max(...utils);
    const e = utils.map(u => Math.exp(u - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(x => x / s);
  }

  return {
    MAX_WEEK, REBATE, MEDICARE_SESSIONS_PER_YEAR, AGE_BANDS,
    distribution, stats, chanceBy, chanceNext, remaining, elapsed, waitStage,
    costPlan, matchService, rankScore,
    parseNumbers, quantile, shareWithin, inTen, clinicStatements, fmt1,
    utility, shares
  };
})();
/* ===== ENGINE END ===== */
