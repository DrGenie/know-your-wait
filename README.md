# Know Your Wait

**Research prototype, version 0.3.0.** A free web tool that helps people in the Hunter region of NSW get mental health support:

- find free and low-cost services they can start today;
- work out what a psychologist will cost after Medicare and private health extras;
- keep track of waiting lists, with the chance of being seen updated as time passes.

It also gives clinics a way to describe their waiting times clearly.

The tool comes from the University of Newcastle pilot study *Waiting, cost and certainty: preferences for access to psychological care* (CHSF Pilot Research Scheme 2027 application).

> Service details were checked on 28 October 2026. **The research results on the Evidence page are simulated** until the study is complete.

## Why

- In 2024-25, 25.3% of people who needed a psychologist said cost was a reason they delayed or did not go (ABS Patient Experiences 2024-25).
- In July 2024, 31% of psychologists could not take new clients, and 49% reported waiting lists of 2 to 4 months (APS member poll).
- Under Better Access, people on the lowest incomes waited longer for a first session than people on the highest incomes (Pirkis et al. 2022).
- Longer waits are linked to missed first appointments (Loumidis and Shropshire 1997).
- Digital support used while waiting is seen as useful, but engagement is low unless a person guides it (Huang et al. 2024).

People often do not know about free services that need no referral, do not know what Medicare will pay, and get no clear information while they wait. This tool addresses those three gaps.

## What the tool does

| Page | What it does |
|---|---|
| Find support | Six optional questions (age, area, UON student, cost, how you want support, GP plan). The list of 11 verified Hunter and national services updates as you answer, grouped into *start today*, *book a time* and *needs a GP referral*. Each card shows cost, how soon, how to start, why it fits and its source. Services that do not fit are listed with the reason. |
| My plan | Builds a step-by-step plan from the services you add: start now, see your GP, book and ask about the wait, questions to ask when you call, and what to do if things get worse. Copy it as text. |
| Work out costs | Live calculator for Better Access. It uses Medicare benefits from 1 July 2026 (psychologist $101.55, MBS item 80110; clinical psychologist $149.05; social worker or OT $89.50) and the 10-sessions-a-year limit. It applies the rule that private health extras cannot top up a Medicare session but can pay for sessions Medicare does not cover. It compares no help, extras only and the best route. |
| My waiting lists | Add each waiting list (a range of weeks, a set date, or "they did not say", which uses a typical 4 to 17 weeks from the APS poll). Each visit shows time waited, the waiting window on a timeline, the chance of being seen in the next 2 weeks (updated for weeks already passed), and advice for that stage. A look-ahead slider shows how this changes over the coming weeks. |
| For services | Paste recent waits. Get a website statement (median, 80th and 90th percentile, rounded up), an SMS under 160 characters, a waiting-list letter listing free supports, and a chart. |
| Evidence | Real figures with sources, plus the pilot study design and simulated results. |
| Urgent help | 000, NSW Mental Health Line, Lifeline, Suicide Call Back Service, 13YARN, Kids Helpline, Beyond Blue. |

Everything runs in the browser. Answers, plans and waiting lists are saved on the device only (local storage) and can be deleted from the About page.

## Run it

The tool is a single static file with no dependencies, build step or external requests.

- **Locally:** open `index.html` in a browser.
- **GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. The `.nojekyll` file is included.

Everything runs in the browser. Nothing entered is sent anywhere. Settings are remembered in the browser's local storage only when that storage is available.

## Repository structure

```
index.html                      the tool (generated; do not edit by hand)
src/index.template.html         page layout, styles and interface code
src/engine.js                   calculation engine (Medicare costs, service matching, waiting-list chances, clinic statements)
simulation/simulate_and_estimate.py   simulates the pilot data and runs the planned analyses
simulation/results/estimates.json     model results used by the tool
simulation/results/*_simulated.csv    simulated choice, participant and gaze data
scripts/embed_results.py        builds index.html from the template, engine and estimates.json
tests/engine.test.mjs           25 tests of the calculation engine and page content (Node 18+)
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

- **Waiting lists.** A range such as "3 to 9 weeks" is treated as an equal chance of being seen in each of those weeks. After `w` whole weeks without being seen, the chance of being seen in the next 2 weeks is P(w < T <= w + 2) / P(T > w). Stages: early, waiting, in the window, longer than they said.
- **Costs.** Medicare sessions are used first, up to 10 a calendar year less those already used. The gap per session is the fee minus the Medicare benefit, or $0 if bulk billed. Remaining sessions use private health extras up to the per-session benefit and yearly limit. Any sessions left after that are paid in full.
- **Service matching.** A service is shown unless an answer rules it out (age band, area, student-only, hardship-only, mode). Skipped questions never hide a service. Results can be sorted by best fit, soonest start or lowest cost.
- **Clinic statements.** Empirical percentiles (type 7), rounded up to whole weeks, so a statement never promises a shorter wait than clients had.

## Limits

- The research results are simulated. Service details, phone numbers, hours and Medicare amounts change; they were checked on 28 October 2026 and should be reviewed every 3 months.
- The tool is a research prototype. It was developed with reference to the International Patient Decision Aid Standards, but it has not been evaluated against them.
- It is not a medical device and does not give clinical advice.
- Public release would require user testing and ethics review.

## Team

Dr Mesfin Genie (lead), Professor Francesco Paolucci, Professor Brendan Boyle, Dr Elaine Xu and Dr Ryan Gallagher, The University of Newcastle, Australia.

Contact: mesfin.genie@newcastle.edu.au

## Licence

MIT. See `LICENSE`.
