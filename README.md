# Know Your Wait

**Research prototype.** A browser tool that helps people compare offers of a first appointment with a psychologist by:

- the chance of being seen by a date that matters to them;
- the total out-of-pocket cost;
- how well each option fits their own priorities.

It also includes a page that helps clinics describe their waiting list clearly.

The tool comes from the University of Newcastle pilot study *Waiting, cost and certainty: preferences for access to psychological care. A pilot discrete choice and eye-tracking study* (CHSF Pilot Research Scheme 2027 application).

> **All pilot results in this repository are simulated.** They were generated to mirror the planned study design and show what the pilot will report. They are not findings. When the study is complete, the simulated estimates will be replaced with the real ones.

## What the tool does

| Page | For | What it does |
|---|---|---|
| Compare my options | People offered appointments | Enter up to four offers (confirmed date or a range of weeks, cost per session, in person or video). The tool shows the chance of being seen by your chosen week as a chart or in words, the earliest and latest week, the total cost for your expected number of sessions, and a fit score based on the pilot's choice model and your own priorities. |
| For clinics | Practices, the PHN, service managers | Paste recent waits. The tool produces a plain-language statement ("half had their first session within 6 weeks, 8 in 10 within 9 weeks"), an icon array and a histogram. |
| Pilot evidence | Reviewers and researchers | Shows the model estimates the pilot will produce: value of a confirmed date in dollars and weeks, text vs chart comprehension, scale-adjusted format comparison and eye-tracking results. |
| About | Everyone | Method, limits, team and privacy. |

Urgent help contacts are shown on every page. Fit scores describe a match to stated priorities and are not clinical advice.

## Run it

The tool is a single static file with no dependencies, build step or external requests.

- **Locally:** open `index.html` in a browser.
- **GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. The `.nojekyll` file is included.

Everything runs in the browser. Nothing entered is sent anywhere. Settings are remembered in the browser's local storage only when that storage is available.

## Repository structure

```
index.html                      the tool (generated; do not edit by hand)
src/index.template.html         tool source with a placeholder for results
simulation/simulate_and_estimate.py   simulates the pilot data and runs the planned analyses
simulation/results/estimates.json     model results used by the tool
simulation/results/*_simulated.csv    simulated choice, participant and gaze data
scripts/embed_results.py        inserts estimates.json into the template to build index.html
tests/engine.test.mjs           tests of the tool's calculation engine (Node 18+)
tests/test_results.py           checks that the analysis recovers the assumed parameters
```

## Rebuild

```bash
pip install -r requirements.txt          # numpy only
python simulation/simulate_and_estimate.py
python scripts/embed_results.py
node tests/engine.test.mjs
python tests/test_results.py
```

The simulation uses a fixed seed (2027), so results are reproducible. It takes under a minute.

## Simulated study design

| Element | Specification |
|---|---|
| Scenario | GP referral to a psychologist for stress and anxiety affecting daily life |
| Attributes | Expected wait 4, 6 or 8 weeks. Reliability: confirmed date, or equal chance of 2 or 3 weeks earlier or later. Cost per session after Medicare rebate $0, $40, $80 or $120. Mode: in person or video |
| Design | 16 paired choices in 2 blocks of 8. D-efficient random search with no dominated pairs. 6 pairs share the same expected wait but differ in reliability |
| Online sample | 200 adults, randomised to text or chart format (100 each) |
| Laboratory sample | 40 adults (20 per format) with simulated eye tracking |
| Assumed preferences | Wait -0.20 per week, spread -0.25 per week SD, cost -0.012 per dollar, video -0.30; 30% individual variation; chart format 25% more consistent responses, same preferences |
| Comprehension | Principal measure simulated with a logistic model (format and numeracy) |
| Eye tracking | Dwell, revisits and between-option comparisons on predefined areas of interest; the chart area is larger than the text area, so dwell is also reported per unit area. Attention to waiting information moderates the weight on reliability |

## Planned analyses (run on the simulated data)

1. Conditional logit with standard errors clustered by respondent.
2. Value of a confirmed date in dollars per session and in weeks of expected wait, with delta-method 95% confidence intervals.
3. Format comparison: separate models by format; pooled model with a relative scale parameter (profile likelihood); joint Wald test of format interactions after scale adjustment.
4. Comprehension: difference in proportions and logistic regression adjusted for numeracy and setting.
5. Eye tracking: format differences in dwell, area-adjusted dwell, revisits and transitions, with participant-clustered standard errors. Attention share predicting comprehension (logistic). An attention-informed choice model that interacts reliability with standardised attention to waiting information.

## Current simulated results

| Coefficient | Estimate | Robust SE | 95% CI | Assumed true value |
|---|---:|---:|---:|---:|
| wait | -0.1959 | 0.0272 | -0.2492 to -0.1425 | -0.2 |
| spread | -0.2639 | 0.0280 | -0.3188 to -0.2090 | -0.25 |
| cost | -0.0138 | 0.0011 | -0.0159 to -0.0117 | -0.012 |
| video | -0.3461 | 0.0619 | -0.4674 to -0.2248 | -0.3 |

| Quantity | Simulated estimate (95% CI) |
|---|---|
| Value of a confirmed date vs a wait of plus or minus 3 weeks ($ per session) | 57 (47 to 68) |
| The same value in weeks of expected wait | 4.0 (3.0 to 5.1) |
| Correct comprehension, text vs chart | 59% vs 80% |
| Relative scale, chart group | 1.05 (0.80 to 1.39) |
| Spread x attention (per SD), laboratory | -0.120 (-0.195 to -0.045) |


## How the tool calculates

- **Distribution.** A confirmed date puts all probability on one week. A range spreads it equally over each week from earliest to latest.
- **Fit score.** Each option's utility is the sum of the pilot coefficients multiplied by:
  - mean wait
  - standard deviation of the wait
  - cost per session
  - video indicator

  Each term is then multiplied by a personal weight from the sliders: 0, 0.5, 1 (typical), 1.5 or 2. Fit shares are logit probabilities across the options entered.
- **Clinic statement.** Empirical percentiles (type 7), rounded up to whole weeks so the statement never promises shorter waits than clients experienced. Proportions are shown as natural frequencies.
- **Tested range.** Options with mean wait outside 4 to 8 weeks, SD above 3 weeks or cost above $120 are flagged as outside the pilot's tested range.

## Limits

- The results are simulated.
- The tool is a research prototype. It was developed with reference to the International Patient Decision Aid Standards, but it has not been evaluated against them.
- It is not a medical device and does not give clinical advice.
- Public release would require user testing and ethics review.

## Team

Dr Mesfin Genie (lead), Professor Francesco Paolucci, Professor Brendan Boyle, Dr Elaine Xu and Dr Ryan Gallagher, The University of Newcastle, Australia.

Contact: mesfin.genie@newcastle.edu.au

## Licence

MIT. See `LICENSE`.
