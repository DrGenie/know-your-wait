/* ===== ENGINE START (pure functions; tested in tests/engine.test.mjs) ===== */
const Engine = (() => {
  const MAX_WEEK = 52;

  /* ---------- Medicare rules (Better Access), checked 28 October 2026 ---------- */
  // Medicare benefit for a session of 50 minutes or more, from 1 July 2026.
  // Psychologist: MBS item 80110, schedule fee $119.45, benefit $101.55 (MBS Online).
  // Clinical psychologist (item 80010) $149.05 and mental health social worker $89.50: published 2026-27 benefits.
  // Better Access: up to 10 individual sessions a calendar year; first referral up to 6, then a GP review.
  // Video and phone sessions are covered with the same limits. Health fund extras cannot top up a Medicare session.
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
    if (entry.curve && entry.curve.length > 1 && entry.kind !== "confirmed") {
      const S = entry.curve.map(x => x / 100), last = entry.lastWeek ?? S.length - 1;
      const q = p => { for (let w = 0; w < S.length; w++) if (S[w] <= 1 - p + 1e-9) return w; return null; };
      const earliest = Math.max(0, q(0.1) ?? 1), latest = q(0.9) ?? last;
      const c = chanceNextS(S, weeks, 2, last);
      let stage = weeks > latest ? "overdue" : weeks >= earliest ? "window" : weeks >= Math.max(1, Math.floor(earliest / 2)) ? "middle" : "early";
      return { days, weeks, stage, next2: c.p, beyond: c.beyond, earliest, latest, method: "records", remainingHalf: medianRemaining(S, weeks), pctThrough: latest > 0 ? Math.min(1, days / (7 * latest)) : 1 };
    }
    const p = distribution(entry);
    const st = stats(p);
    const next2 = chanceNext(p, weeks, 2);
    let stage;
    if (weeks > st.latest) stage = "overdue";
    else if (weeks >= st.earliest) stage = "window";
    else if (weeks >= Math.max(1, Math.floor(st.earliest / 2))) stage = "middle";
    else stage = "early";
    const pctThrough = st.latest > 0 ? Math.min(1, days / (7 * st.latest)) : 1;
    return { days, weeks, stage, next2, beyond: false, earliest: st.earliest, latest: st.latest, pctThrough, method: entry.assumed ? "typical" : "range" };
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
    const fundOnly = a.pathway === "fund";
    const medicareOn = a.hasPlan !== false && !fundOnly;
    const rebate = medicareOn ? (REBATE[a.type] || REBATE.psychologist) : 0;
    // A Medicare benefit is never more than the fee charged.
    const benefit = a.bulkBilled ? fee : Math.min(fee, rebate);
    const medicareGap = a.bulkBilled ? 0 : Math.max(0, fee - rebate);
    const medicareLeft = medicareOn ? MEDICARE_SESSIONS_PER_YEAR - used : 0;
    const ex = a.extras || {};
    const exOn = !!ex.on;
    const exPer = exOn ? Math.max(0, Number(ex.perSession) || 0) : 0;
    const exLimit = exOn ? Math.max(0, Number(ex.annualLimit) || 0) : 0;

    // Each session is paid ONE way: Medicare, or the health fund, or in full. Never both.
    const schedule = [];
    let limitLeft = exLimit, mSessions = 0, exSessions = 0, exPaid = 0, fullSessions = 0, total = 0;
    for (let i = 0; i < sessions; i++) {
      if (mSessions < medicareLeft) {
        const yearNo = used + mSessions + 1;
        mSessions++; total += medicareGap;
        schedule.push({ n: i + 1, payer: a.bulkBilled ? "bulk" : "medicare", paid: round2(benefit), you: round2(medicareGap), review: yearNo === 7 });
        continue;
      }
      const pay = Math.min(exPer, fee, limitLeft);
      if (pay > 0) { exSessions++; exPaid += pay; limitLeft -= pay; total += fee - pay; schedule.push({ n: i + 1, payer: "fund", paid: round2(pay), you: round2(fee - pay) }); }
      else { fullSessions++; total += fee; schedule.push({ n: i + 1, payer: "self", paid: 0, you: round2(fee) }); }
    }
    // Health fund only (no Medicare), for comparison.
    limitLeft = exLimit; let exOnly = 0;
    for (let i = 0; i < sessions; i++) { const pay = Math.min(exPer, fee, limitLeft); limitLeft -= pay; exOnly += fee - pay; }
    // Medicare only, then pay in full.
    const mOnlyN = Math.min(sessions, a.hasPlan === false ? 0 : MEDICARE_SESSIONS_PER_YEAR - used);
    const mOnly = mOnlyN * (a.bulkBilled ? 0 : Math.max(0, fee - (REBATE[a.type] || REBATE.psychologist))) + (sessions - mOnlyN) * fee;

    return {
      fee, rebate, benefit: round2(benefit), medicareGap: round2(medicareGap), medicareLeft,
      medicareSessions: mSessions, extrasSessions: exSessions, extrasPaid: round2(exPaid), fullSessions,
      schedule, reviewAt: (schedule.find(x => x.review) || {}).n || null,
      total: round2(total),
      totalNoHelp: round2(sessions * fee),
      totalExtrasOnly: round2(exOnly),
      totalMedicareOnly: round2(mOnly),
      saved: round2(sessions * fee - total)
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

  /* ---------- Personal trade-offs (choice game) ----------
   * Attributes follow the study's choice tasks:
   *   mean  = expected wait in weeks
   *   half  = how many weeks earlier or later it could be (0 for a set date)
   *   cost  = out-of-pocket cost per session in dollars
   *   video = 1 for a video session, 0 for face to face
   */
  function attrs(o) {
    const cost = Math.max(0, Number(o.cost) || 0), video = o.mode === "video" ? 1 : 0;
    if (o.kind === "confirmed") return { mean: Number(o.week), half: 0, cost, video };
    const a = Math.min(Number(o.from), Number(o.to)), b = Math.max(Number(o.from), Number(o.to));
    return { mean: (a + b) / 2, half: (b - a) / 2, cost, video };
  }
  const KEYS = ["wait", "spread", "cost", "video"];
  function util(b, x) { return b.wait * x.mean + b.spread * x.half + b.cost * x.cost + b.video * x.video; }

  /** Small seeded random number generator (mulberry32), so results are repeatable. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function normals(r) {
    const u = Math.max(r(), 1e-12), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Draws from independent normal distributions; wait and cost are kept negative. */
  function draws(prior, n, seed) {
    const r = rng(seed || 2027), out = [];
    for (let i = 0; i < n; i++) {
      const d = {};
      KEYS.forEach(k => { d[k] = prior[k].mu + prior[k].sd * normals(r); });
      d.cost = Math.min(d.cost, -0.002);
      d.wait = Math.min(d.wait, -0.005);
      out.push(d);
    }
    return out;
  }
  /**
   * Update the starting point with a person's answers.
   * answers: [{ a: attrs, b: attrs, pick: 0 | 1 }] (pick 0 = option A).
   * Importance weights = probability of the answers under each draw (logit).
   */
  function posterior(ds, answers) {
    const logw = ds.map(d => answers.reduce((s, q) => {
      const ua = util(d, q.a), ub = util(d, q.b), m = Math.max(ua, ub);
      const lse = m + Math.log(Math.exp(ua - m) + Math.exp(ub - m));
      return s + (q.pick === 0 ? ua : ub) - lse;
    }, 0));
    const mx = Math.max(...logw);
    const w = logw.map(l => Math.exp(l - mx));
    const sw = w.reduce((a, b) => a + b, 0);
    const mean = {};
    KEYS.forEach(k => { mean[k] = ds.reduce((s, d, i) => s + w[i] * d[k], 0) / sw; });
    const ess = sw * sw / w.reduce((a, b) => a + b * b, 0);
    return { mean, ess };
  }
  /** Plain-language values from a set of weights. */
  function values(b) {
    return {
      certainty: 3 * b.spread / b.cost,   // dollars per session for a set date instead of "3 weeks either way"
      weeksFor50: 50 * b.cost / b.wait,   // extra weeks you would wait to save $50 a session
      faceToFace: b.video / b.cost        // dollars per session to see someone face to face instead of by video
    };
  }
  /** Share of people (draws) whose value is below x. */
  function percentile(ds, key, x) {
    const v = ds.map(d => values(d)[key]).filter(Number.isFinite);
    return v.filter(y => y < x).length / v.length;
  }
  /** Match shares for a list of options under weights b. */
  function rank(b, opts) {
    const u = opts.map(o => util(b, attrs(o)));
    return shares(u);
  }
  /** Three answer choices for the quick check, one correct, as whole "in 10" values. */
  function quizChoices(correctProb) {
    const c = Math.round(correctProb * 10);
    const pool = [c, c >= 5 ? c - 3 : c + 3, c >= 8 ? c - 6 : c + 5, 10 - c, 0, 10].map(x => Math.max(0, Math.min(10, x)));
    const uniq = [...new Set(pool)].slice(0, 3);
    return { correct: c, options: uniq.sort((a, b) => a - b) };
  }

  /* ---------- Sharing: compact links ---------- */
  function b64urlEncode(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    try {
      let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
      while (t.length % 4) t += "=";
      const bin = atob(t), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  }

  /* ---------- Camera calibration: ridge regression ---------- */
  /** Solve (X'X + lambda I) w = X'y. X rows are feature vectors (first column is 1, not penalised). */
  function ridgeFit(X, y, lambda) {
    const k = X[0].length, A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0);
    X.forEach((row, n) => { for (let i = 0; i < k; i++) { b[i] += row[i] * y[n]; for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j]; } });
    for (let i = 1; i < k; i++) A[i][i] += lambda;
    // Gaussian elimination with partial pivoting
    for (let c = 0; c < k; c++) {
      let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      const d = A[c][c] || 1e-12;
      for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / d; for (let j = c; j < k; j++) A[r][j] -= f * A[c][j]; b[r] -= f * b[c]; }
    }
    return b.map((v, i) => v / (A[i][i] || 1e-12));
  }
  function dot(w, x) { return w.reduce((s, v, i) => s + v * x[i], 0); }

  /* ---------- Attention (from camera or pointer) ---------- */
  const AOIS = ["when", "weeks", "pay", "how"];
  /** Sum seconds per area across tasks. byTask: [{ A: {when,..}, B: {...} }] */
  function attentionTotals(byTask) {
    const t = { when: 0, weeks: 0, pay: 0, how: 0 };
    (byTask || []).forEach(task => { if (!task) return; ["A", "B"].forEach(c => { const x = task[c] || {}; AOIS.forEach(a => { t[a] += x[a] || 0; }); }); });
    const total = AOIS.reduce((s, a) => s + t[a], 0);
    const share = {}; AOIS.forEach(a => { share[a] = total > 0 ? t[a] / total : 0; });
    return { seconds: t, total, share, waitShare: total > 0 ? (t.when + t.weeks) / total : 0 };
  }
  /** Did the person barely look at the waiting time of the option they picked? */
  function missedWait(task, pick, minTotal) {
    if (!task) return false;
    const c = task[pick === 0 ? "A" : "B"] || {};
    const tot = AOIS.reduce((s, a) => s + (c[a] || 0), 0) + AOIS.reduce((s, a) => s + ((task[pick === 0 ? "B" : "A"] || {})[a] || 0), 0);
    if (tot < (minTotal || 1.5)) return false;
    return ((c.when || 0) + (c.weeks || 0)) / tot < 0.12;
  }
  /**
   * Summary of where a person looked across the choice tasks. Descriptive only:
   * it never changes their results or ranking.
   * tasks: [{ dw: {A:{when,weeks,pay,how}, B:{...}}, sw: side switches, t: seconds, pick: 0|1 }]
   */
  function eyeSummary(tasks) {
    const list = (tasks || []).filter(x => x && x.dw && (x.pick === 0 || x.pick === 1));
    const tot = attentionTotals(list.map(x => x.dw));
    const sideSum = d => AOIS.reduce((s, a) => s + ((d || {})[a] || 0), 0);
    let moreChosen = 0, judged = 0, latest = 0, switches = 0, time = 0;
    const chosen = { when: 0, weeks: 0, pay: 0, how: 0 }, other = { when: 0, weeks: 0, pay: 0, how: 0 };
    list.forEach(x => {
      const c = x.dw[x.pick === 0 ? "A" : "B"] || {}, o = x.dw[x.pick === 0 ? "B" : "A"] || {};
      const sc = sideSum(c), so = sideSum(o);
      if (sc + so >= 0.5) { judged++; if (sc > so) moreChosen++; }
      if ((c.weeks || 0) + (o.weeks || 0) >= 0.4) latest++;
      AOIS.forEach(a => { chosen[a] += c[a] || 0; other[a] += o[a] || 0; });
      switches += x.sw || 0; time += x.t || 0;
    });
    const n = list.length;
    const avgSwitch = n ? switches / n : 0, avgTime = n ? time / n : 0;
    const top = AOIS.slice().sort((p, q) => tot.seconds[q] - tot.seconds[p])[0];
    let style = "balanced";
    if (n && avgTime < 5) style = "quick";
    else if (avgSwitch >= 4) style = "comparer";
    else if (tot.share.pay >= 0.4) style = "cost";
    else if (tot.waitShare >= 0.6) style = "date";
    return { n, total: tot.total, seconds: tot.seconds, share: tot.share, waitShare: tot.waitShare,
      moreChosen, judged, latest, avgSwitch, avgTime, chosen, other, top, style };
  }
  /** Mean distance between predicted and true points (both 0..1 of screen), in screen fractions. */
  function calibError(pred, truth) {
    if (!pred.length) return NaN;
    return pred.reduce((s, p, i) => s + Math.hypot(p[0] - truth[i][0], p[1] - truth[i][1]), 0) / pred.length;
  }

  /* ---------- Waiting times from clinic records ----------
   * Completed waits (people already seen) are events. People still waiting are
   * right-censored at the time they have waited so far. Kaplan-Meier gives the
   * chance of still waiting after t weeks without dropping the longest waits.
   */
  function kmFit(completed, ongoing) {
    const ev = (completed || []).filter(x => x >= 0).map(t => [t, 1]);
    const ce = (ongoing || []).filter(x => x >= 0).map(t => [t, 0]);
    const all = ev.concat(ce).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let atRisk = all.length, S = 1, gw = 0;
    const t = [0], surv = [1], se = [0];
    for (let i = 0; i < all.length;) {
      const time = all[i][0]; let d = 0, c = 0;
      while (i < all.length && all[i][0] === time) { if (all[i][1]) d++; else c++; i++; }
      if (d > 0) {
        S *= 1 - d / atRisk;
        if (atRisk > d) gw += d / (atRisk * (atRisk - d));
        t.push(time); surv.push(S); se.push(S * Math.sqrt(gw));
      }
      atRisk -= d + c;
    }
    const maxObs = all.length ? all[all.length - 1][0] : 0;
    const maxEvent = ev.length ? Math.max(...ev.map(x => x[0])) : 0;
    return { t, S: surv, se, nCompleted: ev.length, nOngoing: ce.length, maxObs, maxEvent };
  }
  function kmAt(km, time) { let s = 1; for (let i = 0; i < km.t.length; i++) { if (km.t[i] <= time + 1e-9) s = km.S[i]; else break; } return s; }
  /** Smallest time by which a share p has been seen, or null if the records do not reach it. */
  function kmQuantile(km, p) { for (let i = 0; i < km.t.length; i++) if (km.S[i] <= 1 - p + 1e-9) return km.t[i]; return null; }
  /** Chance of still waiting at the end of each whole week, 0..maxW. */
  function kmWeekly(km, maxW) { const out = []; for (let w = 0; w <= maxW; w++) out.push(kmAt(km, w)); return out; }
  /**
   * From a weekly "still waiting" curve S: chance of being seen in the next h weeks
   * for someone who has already waited w weeks. beyond = true when this goes past the records.
   */
  function chanceNextS(S, w, h, lastWeek) {
    const sw = S[Math.min(w, S.length - 1)];
    if (!(sw > 1e-9)) return { p: null, beyond: false };
    const end = Math.min(w + h, S.length - 1);
    const p = (sw - S[end]) / sw;
    return { p: Math.max(0, Math.min(1, p)), beyond: w + h > (lastWeek ?? S.length - 1) };
  }
  /** Weeks more until half of the people who have waited w weeks are seen, or null. */
  function medianRemaining(S, w) {
    const sw = S[Math.min(w, S.length - 1)]; if (!(sw > 1e-9)) return null;
    for (let k = 1; w + k < S.length; k++) if (S[w + k] / sw <= 0.5 + 1e-9) return k;
    return null;
  }
  /** Statements for clinics using completed and ongoing waits (weeks). */
  function clinicSurvival(completed, ongoing, serviceName) {
    const km = kmFit(completed, ongoing), up = x => x === null ? null : Math.max(1, Math.ceil(x - 1e-9));
    const q10 = up(kmQuantile(km, 0.1)), q50 = up(kmQuantile(km, 0.5)), q90 = up(kmQuantile(km, 0.9));
    const naive = completed.length ? { q50: Math.max(1, Math.ceil(quantile(completed, 0.5))), q90: Math.max(1, Math.ceil(quantile(completed, 0.9))) } : null;
    const lastWeek = Math.ceil(km.maxObs);
    const name = (serviceName || "").trim() || "our service";
    const p90 = q90 === null ? `more than ${Math.max(1, Math.floor(km.maxEvent))} weeks` : `${q90} weeks`;
    const p50 = q50 === null ? `more than ${Math.max(1, Math.floor(km.maxEvent))} weeks` : `${q50} weeks`;
    const web = `Waiting times at ${name}: half of new clients have their first appointment within ${p50}, and 9 in 10 within ${p90}. This includes ${km.nCompleted} people we have seen and ${km.nOngoing} people still waiting.`;
    let sms = `${name}: half of new clients are seen within ${p50}, 9 in 10 within ${p90}. Help sooner: 1800 595 212. Emergency: 000`;
    if (sms.length > 160) sms = `Half of new clients are seen within ${p50}, 9 in 10 within ${p90}. Help sooner: 1800 595 212. Emergency: 000`;
    const enough = km.nCompleted >= 30 && km.nOngoing >= 1;
    return { km, q10, q50, q90, naive, lastWeek, web, sms, enough, p50, p90 };
  }
  /** Validation of a guide against what actually happened. cases: [{ p, seen }]. */
  function validateGuide(cases, bins) {
    const ok = (cases || []).filter(c => Number.isFinite(c.p) && (c.seen === 0 || c.seen === 1));
    const k = bins || 5, out = [];
    for (let i = 0; i < k; i++) {
      const lo = i / k, hi = (i + 1) / k, g = ok.filter(c => c.p >= lo && (c.p < hi || (i === k - 1 && c.p <= 1)));
      out.push({ lo, hi, n: g.length, meanP: g.length ? g.reduce((s, c) => s + c.p, 0) / g.length : NaN, observed: g.length ? g.reduce((s, c) => s + c.seen, 0) / g.length : NaN });
    }
    const brier = ok.length ? ok.reduce((s, c) => s + (c.p - c.seen) ** 2, 0) / ok.length : NaN;
    return { n: ok.length, brier, bins: out };
  }

  return {
    b64urlEncode, b64urlDecode, ridgeFit, dot, AOIS, attentionTotals, missedWait, eyeSummary, calibError,
    kmFit, kmAt, kmQuantile, kmWeekly, chanceNextS, medianRemaining, clinicSurvival, validateGuide,
    MAX_WEEK, REBATE, MEDICARE_SESSIONS_PER_YEAR, AGE_BANDS,
    distribution, stats, chanceBy, chanceNext, remaining, elapsed, waitStage,
    costPlan, matchService, rankScore,
    parseNumbers, quantile, shareWithin, inTen, clinicStatements, fmt1,
    utility, shares,
    attrs, util, rng, draws, posterior, values, percentile, rank, quizChoices
  };
})();
/* ===== ENGINE END ===== */
