/* ===== ENGINE START (pure functions; tested in tests/engine.test.mjs) ===== */
const Engine = (() => {
  const MAX_WEEK = 30;

  function clampInt(x, lo, hi) {
    x = Math.round(Number(x));
    if (!Number.isFinite(x)) x = lo;
    return Math.min(hi, Math.max(lo, x));
  }

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

  /** Utility of an option given model coefficients and personal weight multipliers. */
  function utility(opt, coef, weights) {
    const st = stats(distribution(opt));
    const w = Object.assign({ wait: 1, certainty: 1, cost: 1, mode: 1 }, weights || {});
    return coef.wait * st.mean * w.wait
      + coef.spread * st.sd * w.certainty
      + coef.cost * Number(opt.cost || 0) * w.cost
      + coef.video * (opt.mode === "video" ? 1 : 0) * w.mode;
  }

  function shares(utils) {
    const m = Math.max(...utils);
    const e = utils.map(u => Math.exp(u - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(x => x / s);
  }

  /** Is the option inside the attribute ranges tested in the pilot? */
  function inTestedRange(opt) {
    const st = stats(distribution(opt));
    return st.mean >= 4 - 1e-9 && st.mean <= 8 + 1e-9 && st.sd <= 3 + 1e-9
      && Number(opt.cost) >= 0 && Number(opt.cost) <= 120;
  }

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

  /** Text description of an option's wait, used in the "Words" format. */
  function describe(opt, deadline) {
    const p = distribution(opt), st = stats(p), c = chanceBy(p, deadline);
    if (opt.kind === "confirmed") {
      return "Your first session is confirmed for week " + st.earliest + ". " +
        (st.earliest <= deadline ? "That is within week " + deadline + "." : "That is after week " + deadline + ".");
    }
    return "You could be seen in any week from week " + st.earliest + " to week " + st.latest +
      ", with each week equally likely. The average wait is " + fmt1(st.mean) + " weeks. " +
      "The chance of being seen by week " + deadline + " is " + Math.round(c * 100) + "%, " + inTen(c) + ".";
  }

  function fmt1(x) { return (Math.round(x * 10) / 10).toString(); }

  return { MAX_WEEK, distribution, stats, chanceBy, utility, shares, inTestedRange, parseNumbers, quantile, shareWithin, inTen, describe, fmt1 };
})();
/* ===== ENGINE END ===== */