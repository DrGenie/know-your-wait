# Know Your Wait

**Research prototype, version 0.4.0.** A free web tool that helps people in the Hunter region of NSW get mental health support:

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

Version 0.4.0 is built around one guided journey, **Compare my options**. It takes about 3 minutes, and each step appears when the person presses Next.

1. **Safety check.** If the person is not safe, crisis numbers are shown at once.
2. **About you.** Age, area, UON student, whether cost is a problem. Every question can be skipped.
3. **Your goal.** When they want to start, and whether they have a GP mental health plan. Options that need a plan get 1 extra week.
4. **Your options.** Typical Hunter options for someone like them (simulated waits; Medicare gap from the real $101.55 rebate). Each option can be changed to match a real offer, or removed, and new offers can be added.
5. **6 quick choices.** A short game of paired appointments in the same format as the study's choice tasks.
6. **Results.**
   - Personal trade-offs: what a set date is worth per session, how many weeks they would wait to save $50 a session, and what face to face is worth. Each one is compared with people in the study.
   - Options ranked by personal match, each with the chance of being seen by the goal week.
   - A plain reason for the best match.
   - A one-question comprehension check.
7. **Your plan.**
   - Free support to start today, matched to the person.
   - Seeing the GP if needed.
   - Questions to ask when calling, based on what matters to them.
   - One button to add the chosen option to **My waiting lists**.

### How the study feeds the tool

| Study component | What it changes in the tool |
|---|---|
| Online choice experiment (200 adults) | Its estimates are the starting point for each person's trade-offs. The person's 6 choices update them (Bayesian importance weighting over 4,000 draws), and the population spread gives the "compared with others" figures. |
| Eye-tracking and comprehension (40 adults) | Decides the display. Waits are shown as a picture of weeks first, because the picture was better understood; words are one tap away. The latest week is shown in orange and said in words, because people tend to miss it. The quick check reuses the study's comprehension question. |
| Services (For services page) | Turns a clinic's recent waits into the ranges people see. In this prototype the Hunter waits are simulated. |

### Other pages

| Page | What it does |
|---|---|
| My waiting lists | Each visit recalculates how long the person has waited and the chance of being seen in the next 2 weeks. It shows a timeline and advice for each stage, and a look-ahead slider shows the coming weeks. |
| Cost calculator | Better Access costs with Medicare benefits from 1 July 2026, the 10-session limit and the private health extras rule. |
| For services | A website statement, a 1-SMS message and a waiting-list letter from a clinic's recent waits. |
| How it works | The study design, simulated results, technical details, sources and privacy. |
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
tests/engine.test.mjs           33 tests of the calculation engine and page content (Node 18+)
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
- **Personal trade-offs.** Prior for each weight: study estimate, SD 50% of its size (independent normals, wait and cost kept negative), 4,000 seeded draws. Each draw is weighted by the logit probability of the person's answers; the weighted mean gives their weights. Values: set date = 3 x spread / cost; weeks to save $50 = 50 x cost / wait; face to face = video / cost. "Compared with others" uses draws with SD 30%, the simulated spread between people.
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
