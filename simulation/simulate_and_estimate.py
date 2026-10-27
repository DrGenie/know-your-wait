"""
Know Your Wait: simulated pilot data and analysis.

This script creates SIMULATED data that mirror the planned CHSF pilot
(online DCE, n = 200; laboratory eye-tracking study, n = 40), estimates the
planned models and writes the results used by the web tool.

Nothing here is real data. The "true" parameters below are assumptions chosen
to be plausible for demonstration only.

Run:  python simulation/simulate_and_estimate.py
Needs: numpy (no other dependencies).
"""
import json
import csv
import os
import itertools
import numpy as np

SEED = 2027
rng = np.random.default_rng(SEED)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "results")
os.makedirs(OUT, exist_ok=True)

# --------------------------------------------------------------------------
# 1. Experimental design
# --------------------------------------------------------------------------
EXPECTED = [4, 6, 8]          # expected wait, weeks
SPREAD = [0, 2, 3]            # +/- weeks; equal chance earlier or later (SD = spread)
COST = [0, 40, 80, 120]       # out-of-pocket cost per session after Medicare rebate, AUD
MODE = [0, 1]                 # 0 = in person, 1 = video

PROFILES = [dict(E=e, S=s, C=c, V=v) for e, s, c, v in itertools.product(EXPECTED, SPREAD, COST, MODE)]

# Assumed ("true") preference parameters used to simulate choices
TRUE = dict(wait=-0.20, spread=-0.25, cost=-0.012, video=-0.30)
NAMES = ["wait", "spread", "cost", "video"]


def x_of(p):
    return np.array([p["E"], p["S"], p["C"], p["V"]], dtype=float)


def dominated(a, b):
    """True if one profile is at least as good on every attribute (given expected signs)."""
    xa, xb = x_of(a), x_of(b)
    better_a = np.all(xa <= xb)   # all attributes are 'bads'
    better_b = np.all(xb <= xa)
    return better_a or better_b


def d_error(pairs, beta):
    info = np.zeros((4, 4))
    for a, b in pairs:
        X = np.vstack([x_of(a), x_of(b)])
        u = X @ beta
        p = np.exp(u - u.max()); p /= p.sum()
        xbar = p @ X
        Z = X - xbar
        info += (Z * p[:, None]).T @ Z
    sign, logdet = np.linalg.slogdet(info)
    if sign <= 0:
        return np.inf
    return np.exp(-logdet / 4)


def make_design(n_tasks=16, n_equal=6, iters=6000):
    """Random-search D-efficient design with constraints:
    no dominated pairs, no identical waiting distributions in non-RQ1 pairs,
    and n_equal pairs with the same expected wait but different reliability."""
    beta = np.array([TRUE[k] for k in NAMES])
    best, best_d = None, np.inf
    for _ in range(iters):
        pairs = []
        while len(pairs) < n_tasks:
            a, b = rng.choice(len(PROFILES), 2, replace=False)
            a, b = PROFILES[a], PROFILES[b]
            if dominated(a, b):
                continue
            need_equal = sum(1 for x, y in pairs if x["E"] == y["E"] and x["S"] != y["S"]) < n_equal
            if need_equal and not (a["E"] == b["E"] and a["S"] != b["S"]):
                continue
            pairs.append((a, b))
        d = d_error(pairs, beta)
        if d < best_d:
            best, best_d = pairs, d
    return best, best_d


design, design_d = make_design()
blocks = [design[:8], design[8:]]
# make sure each block holds 3 equal-expected-wait pairs
eq = [p for p in design if p[0]["E"] == p[1]["E"]]
neq = [p for p in design if p[0]["E"] != p[1]["E"]]
rest = eq[6:] + neq                       # 10 remaining pairs
blocks = [eq[:3] + rest[:5], eq[3:6] + rest[5:10]]
assert all(len(b) == 8 for b in blocks)

# --------------------------------------------------------------------------
# 2. Simulate respondents
# --------------------------------------------------------------------------
def simulate_people(n, setting, start_id):
    people = []
    for i in range(n):
        fmt = "graphic" if i % 2 else "text"
        numeracy = rng.normal(0, 1)
        student = rng.random() < (0.55 if setting == "lab" else 0.40)
        people.append(dict(id=start_id + i, setting=setting, format=fmt,
                           block=int(rng.integers(0, 2)), numeracy=numeracy,
                           student=int(student),
                           # individual taste variation (sd 30% of mean)
                           beta={k: TRUE[k] * (1 + 0.3 * rng.normal()) for k in NAMES}))
    return people


online = simulate_people(200, "online", 1)
lab = simulate_people(40, "lab", 1001)

# graphic format: assumed more consistent responses (scale 1.25), same preferences
SCALE = {"text": 1.0, "graphic": 1.25}

rows = []          # long-format choice data
for person in online + lab:
    for t, (a, b) in enumerate(blocks[person["block"]]):
        X = np.vstack([x_of(a), x_of(b)])
        bvec = np.array([person["beta"][k] for k in NAMES])
        u = SCALE[person["format"]] * (X @ bvec) + rng.gumbel(size=2)
        ch = int(np.argmax(u))
        for alt in range(2):
            rows.append(dict(id=person["id"], setting=person["setting"], format=person["format"],
                             task=t + 1, alt=alt + 1, choice=int(alt == ch),
                             wait=X[alt, 0], spread=X[alt, 1], cost=X[alt, 2], video=X[alt, 3]))

# comprehension (principal measure: correct chance of being seen by a stated week)
for person in online + lab:
    lin = 0.45 + (0.65 if person["format"] == "graphic" else 0.0) + 0.6 * person["numeracy"]
    person["correct"] = int(rng.random() < 1 / (1 + np.exp(-lin)))

# --------------------------------------------------------------------------
# 3. Simulate eye-tracking measures (lab only)
#     AOIs: waiting-time information, cost, mode. Graphic AOI area is larger.
# --------------------------------------------------------------------------
AOI_AREA = {"text": {"wait": 6.0, "cost": 3.0, "video": 3.0},
            "graphic": {"wait": 14.0, "cost": 3.0, "video": 3.0}}  # % of screen
gaze = []
for person in lab:
    person["att_trait"] = rng.normal(0, 1)   # tendency to attend to waiting info
    for t in range(8):
        base_wait = 2.2 if person["format"] == "graphic" else 1.8   # seconds
        dw = np.exp(np.log(base_wait) + 0.35 * person["att_trait"] + rng.normal(0, 0.4))
        dc = np.exp(np.log(1.1) + rng.normal(0, 0.4))
        dv = np.exp(np.log(0.6) + rng.normal(0, 0.4))
        revisits = rng.poisson(2.4 if person["format"] == "graphic" else 1.7)
        transitions = rng.poisson(2.0 if person["format"] == "graphic" else 3.0)
        gaze.append(dict(id=person["id"], format=person["format"], task=t + 1,
                         dwell_wait=dw, dwell_cost=dc, dwell_video=dv,
                         revisits_wait=revisits, transitions_wait=transitions))

# attention moderates the weight on reliability: re-simulate lab spread weights accordingly
for person in lab:
    person["beta"]["spread"] = TRUE["spread"] * (1 + 0.35 * person["att_trait"] + 0.15 * rng.normal())
    person["correct"] = int(rng.random() < 1 / (1 + np.exp(-(0.45 + (0.65 if person["format"] == "graphic" else 0)
                                                             + 0.5 * person["att_trait"] + 0.5 * person["numeracy"]))))
rows = [r for r in rows if r["setting"] == "online"]
for person in lab:
    for t, (a, b) in enumerate(blocks[person["block"]]):
        X = np.vstack([x_of(a), x_of(b)])
        bvec = np.array([person["beta"][k] for k in NAMES])
        u = SCALE[person["format"]] * (X @ bvec) + rng.gumbel(size=2)
        ch = int(np.argmax(u))
        for alt in range(2):
            rows.append(dict(id=person["id"], setting="lab", format=person["format"],
                             task=t + 1, alt=alt + 1, choice=int(alt == ch),
                             wait=X[alt, 0], spread=X[alt, 1], cost=X[alt, 2], video=X[alt, 3]))

# --------------------------------------------------------------------------
# 4. Estimation helpers: conditional logit with cluster-robust SEs
# --------------------------------------------------------------------------
def clogit(data, cols, cluster="id", extra=None):
    """data: list of rows (2 per task). Returns beta, cluster-robust covariance, loglik."""
    groups = {}
    for r in data:
        groups.setdefault((r["id"], r["task"]), []).append(r)
    keys = sorted(groups)
    Xs, ys, cl = [], [], []
    for k in keys:
        g = sorted(groups[k], key=lambda r: r["alt"])
        X = np.array([[f(r) if callable(f) else r[f] for f in cols] for r in g], dtype=float)
        Xs.append(X); ys.append(np.array([r["choice"] for r in g])); cl.append(g[0][cluster])
    K = len(cols)
    b = np.zeros(K)
    for _ in range(100):
        g_tot = np.zeros(K); H = np.zeros((K, K)); ll = 0.0
        for X, y in zip(Xs, ys):
            u = X @ b; p = np.exp(u - u.max()); p /= p.sum()
            ll += np.log(p[y == 1][0])
            xbar = p @ X
            g_tot += X[y == 1][0] - xbar
            Z = X - xbar
            H -= (Z * p[:, None]).T @ Z
        step = np.linalg.solve(H, g_tot)
        b -= step
        if np.max(np.abs(step)) < 1e-10:
            break
    # cluster-robust sandwich
    scores = {}
    for X, y, c in zip(Xs, ys, cl):
        u = X @ b; p = np.exp(u - u.max()); p /= p.sum()
        s = X[y == 1][0] - p @ X
        scores[c] = scores.get(c, 0) + s
    meat = sum(np.outer(s, s) for s in scores.values())
    Hinv = np.linalg.inv(-H)
    G = len(scores)
    V = Hinv @ meat @ Hinv * G / (G - 1)
    return b, V, ll, len(Xs), G


def logit(y, X, clusters=None):
    b = np.zeros(X.shape[1])
    for _ in range(100):
        p = 1 / (1 + np.exp(-X @ b))
        g = X.T @ (y - p)
        H = -(X * (p * (1 - p))[:, None]).T @ X
        step = np.linalg.solve(H, g)
        b -= step
        if np.max(np.abs(step)) < 1e-10:
            break
    p = 1 / (1 + np.exp(-X @ b))
    V = np.linalg.inv(-H)
    return b, V


def ols_cluster(y, X, clusters):
    XtX_inv = np.linalg.inv(X.T @ X)
    b = XtX_inv @ X.T @ y
    e = y - X @ b
    meat = np.zeros((X.shape[1], X.shape[1]))
    for c in np.unique(clusters):
        m = clusters == c
        s = X[m].T @ e[m]
        meat += np.outer(s, s)
    G = len(np.unique(clusters))
    V = XtX_inv @ meat @ XtX_inv * G / (G - 1)
    return b, V


def ci(est, se):
    return [est - 1.96 * se, est + 1.96 * se]


def ratio(b, V, i, j, scale=1.0):
    """scale * b_i / b_j with delta-method SE."""
    r = scale * b[i] / b[j]
    grad = np.zeros(len(b)); grad[i] = scale / b[j]; grad[j] = -scale * b[i] / b[j] ** 2
    se = float(np.sqrt(grad @ V @ grad))
    return float(r), se


def fmt_coef(b, V, names):
    se = np.sqrt(np.diag(V))
    return [dict(name=n, est=float(x), se=float(s), ci=ci(float(x), float(s)), z=float(x / s))
            for n, x, s in zip(names, b, se)]

# --------------------------------------------------------------------------
# 5. Analyses
# --------------------------------------------------------------------------
res = {"meta": dict(simulated=True, seed=SEED, n_online=200, n_lab=40, tasks_per_person=8,
                    design_d_error=float(design_d),
                    note="All results are SIMULATED for demonstration. They are not findings."),
       "true_parameters": TRUE}

online_rows = [r for r in rows if r["setting"] == "online"]

# 5.1 main model (online)
b, V, ll, nobs, G = clogit(online_rows, NAMES)
res["main_model"] = dict(coefs=fmt_coef(b, V, NAMES), loglik=float(ll), choices=nobs, respondents=G)

# value of reliability: confirmed date vs +/- 3 weeks
for label, i, j, sc in [("dollars_per_session_confirmed_vs_pm3", 1, 2, 3.0),
                        ("weeks_confirmed_vs_pm3", 1, 0, 3.0),
                        ("dollars_per_week_shorter_wait", 0, 2, 1.0),
                        ("dollars_in_person_vs_video", 3, 2, 1.0)]:
    r, se = ratio(b, V, i, j, sc)
    res.setdefault("values", {})[label] = dict(est=r, se=se, ci=ci(r, se))

# 5.2 format comparison: interactions + relative scale (grid search on scale)
def scaled_rows(rows_, lam):
    out = []
    for r in rows_:
        k = lam if r["format"] == "graphic" else 1.0
        rr = dict(r)
        for n in NAMES:
            rr[n] = r[n] * k
        out.append(rr)
    return out

best = None
for lam in np.linspace(0.6, 2.0, 141):
    bb, VV, l, _, _ = clogit(scaled_rows(online_rows, lam), NAMES)
    if best is None or l > best[2]:
        best = (lam, bb, l)
lam_hat, _, ll_scale = best
# profile-likelihood 95% CI for scale
grid = []
for lam in np.linspace(0.6, 2.0, 141):
    _, _, l, _, _ = clogit(scaled_rows(online_rows, lam), NAMES)
    grid.append((float(lam), float(l)))
lam_ci = [min(g for g, l in grid if ll_scale - l <= 1.92), max(g for g, l in grid if ll_scale - l <= 1.92)]

by_format = {}
for f in ("text", "graphic"):
    bf, Vf, _, _, Gf = clogit([r for r in online_rows if r["format"] == f], NAMES)
    vr, vse = ratio(bf, Vf, 1, 2, 3.0)
    wr, wse = ratio(bf, Vf, 1, 0, 3.0)
    by_format[f] = dict(coefs=fmt_coef(bf, Vf, NAMES), respondents=Gf,
                        value_dollars=dict(est=vr, se=vse, ci=ci(vr, vse)),
                        value_weeks=dict(est=wr, se=wse, ci=ci(wr, wse)))
# test of preference difference after scale: interaction model on scaled data
ints = NAMES + [lambda r, n=n: r[n] * (r["format"] == "graphic") for n in NAMES]
bi, Vi, ll_int, _, _ = clogit(scaled_rows(online_rows, lam_hat), ints)
inter = fmt_coef(bi[4:], Vi[4:, 4:], [n + " x graphic" for n in NAMES])
wald = float(bi[4:] @ np.linalg.solve(Vi[4:, 4:], bi[4:]))
res["format"] = dict(by_format=by_format, relative_scale_graphic=dict(est=float(lam_hat), ci=lam_ci),
                     interactions_after_scale=inter, wald_chi2_df4=wald)

# 5.3 comprehension (all participants)
people = online + lab
y = np.array([p["correct"] for p in people], float)
X = np.column_stack([np.ones(len(people)), [p["format"] == "graphic" for p in people],
                     [p["numeracy"] for p in people], [p["setting"] == "lab" for p in people]]).astype(float)
bl, Vl = logit(y, X)
prop = {f: float(np.mean([p["correct"] for p in people if p["format"] == f])) for f in ("text", "graphic")}
n_f = {f: sum(1 for p in people if p["format"] == f) for f in ("text", "graphic")}
diff = prop["graphic"] - prop["text"]
se_diff = float(np.sqrt(prop["graphic"] * (1 - prop["graphic"]) / n_f["graphic"] + prop["text"] * (1 - prop["text"]) / n_f["text"]))
res["comprehension"] = dict(proportion_correct=prop, n=n_f, difference=dict(est=diff, se=se_diff, ci=ci(diff, se_diff)),
                            odds_ratio_graphic=dict(est=float(np.exp(bl[1])),
                                                    ci=[float(np.exp(bl[1] - 1.96 * np.sqrt(Vl[1, 1]))),
                                                        float(np.exp(bl[1] + 1.96 * np.sqrt(Vl[1, 1])))]))

# 5.4 eye tracking (lab)
cl = np.array([g["id"] for g in gaze])
gfmt = np.array([g["format"] == "graphic" for g in gaze], float)
Xg = np.column_stack([np.ones(len(gaze)), gfmt])
et = {}
for name, vals in [
    ("log_dwell_wait_seconds", np.log([g["dwell_wait"] for g in gaze])),
    ("dwell_wait_per_pct_area", np.array([g["dwell_wait"] / AOI_AREA[g["format"]]["wait"] for g in gaze])),
    ("revisits_wait", np.array([g["revisits_wait"] for g in gaze], float)),
    ("transitions_between_options_wait", np.array([g["transitions_wait"] for g in gaze], float)),
]:
    bg, Vg = ols_cluster(vals, Xg, cl)
    means = {f: float(np.mean(vals[gfmt == (f == "graphic")])) for f in ("text", "graphic")}
    et[name] = dict(mean=means, graphic_minus_text=dict(est=float(bg[1]), se=float(np.sqrt(Vg[1, 1])),
                                                        ci=ci(float(bg[1]), float(np.sqrt(Vg[1, 1])))))
# attention share by participant
share = {}
for pid in sorted(set(cl)):
    gg = [g for g in gaze if g["id"] == pid]
    tot = sum(g["dwell_wait"] + g["dwell_cost"] + g["dwell_video"] for g in gg)
    share[pid] = sum(g["dwell_wait"] for g in gg) / tot
mean_share = float(np.mean(list(share.values())))
sd_share = float(np.std(list(share.values())))
et["attention_share_wait"] = dict(mean=mean_share, sd=sd_share,
                                  by_format={f: float(np.mean([share[p["id"]] for p in lab if p["format"] == f]))
                                             for f in ("text", "graphic")})
# attention -> comprehension
yl = np.array([p["correct"] for p in lab], float)
z = np.array([(share[p["id"]] - mean_share) / sd_share for p in lab])
Xl = np.column_stack([np.ones(len(lab)), z, [p["format"] == "graphic" for p in lab]]).astype(float)
ba, Va = logit(yl, Xl)
et["attention_predicts_comprehension"] = dict(odds_ratio_per_sd=float(np.exp(ba[1])),
                                              ci=[float(np.exp(ba[1] - 1.96 * np.sqrt(Va[1, 1]))),
                                                  float(np.exp(ba[1] + 1.96 * np.sqrt(Va[1, 1])))])
# attention-informed choice model
lab_rows = [r for r in rows if r["setting"] == "lab"]
zmap = {p["id"]: (share[p["id"]] - mean_share) / sd_share for p in lab}
cols = NAMES + [lambda r: r["spread"] * zmap[r["id"]]]
bc, Vc, _, nl, Gl = clogit(lab_rows, cols)
et["attention_choice_model"] = dict(coefs=fmt_coef(bc, Vc, NAMES + ["spread x attention (per SD)"]),
                                    choices=nl, respondents=Gl)
et["aoi_area_pct"] = AOI_AREA
res["eye_tracking"] = et

# design for the record
res["design"] = [[dict(a), dict(b)] for blk in blocks for a, b in blk]

with open(os.path.join(OUT, "estimates.json"), "w") as f:
    json.dump(res, f, indent=2)
with open(os.path.join(OUT, "choices_simulated.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
with open(os.path.join(OUT, "gaze_simulated.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(gaze[0].keys())); w.writeheader(); w.writerows(gaze)
with open(os.path.join(OUT, "participants_simulated.csv"), "w", newline="") as f:
    keys = ["id", "setting", "format", "block", "student", "numeracy", "correct"]
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
    for p in people:
        w.writerow({k: p[k] for k in keys})

v = res["values"]
print("Main model:", [(c["name"], round(c["est"], 4)) for c in res["main_model"]["coefs"]])
print("Value of confirmed date vs +/-3 weeks: $%.0f per session (95%% CI %.0f to %.0f)" %
      (v["dollars_per_session_confirmed_vs_pm3"]["est"], *v["dollars_per_session_confirmed_vs_pm3"]["ci"]))
print("  in weeks: %.2f (%.2f to %.2f)" % (v["weeks_confirmed_vs_pm3"]["est"], *v["weeks_confirmed_vs_pm3"]["ci"]))
print("Relative scale graphic:", round(lam_hat, 2), lam_ci, "Wald(4) after scale:", round(wald, 2))
print("Comprehension:", prop, "OR", res["comprehension"]["odds_ratio_graphic"])
print("Attention x spread:", et["attention_choice_model"]["coefs"][-1])
