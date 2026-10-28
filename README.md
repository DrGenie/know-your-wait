# Know Your Wait

**Research prototype, version 0.5.0.** A free web tool for people in the Hunter region of NSW who are waiting to see a psychologist. In about 3 minutes it helps them:

- compare their options and find out what matters most to them;
- get a plan, with free support they can start today;
- share the plan by QR code, WhatsApp or text;
- track their waiting list, with the chance of being seen updated as time passes.

It also gives clinics a clear way to describe their waiting times, and a QR code that adds their waiting list to a person's tracker.

The tool comes from the University of Newcastle pilot study *Waiting, cost and certainty: preferences for access to psychological care* (CHSF Pilot Research Scheme 2027 application).

> Service details were checked on 28 October 2026. **The research results in Technical details are simulated** until the study is complete.

## Why

- In 2024-25, 25.3% of people who needed a psychologist said cost was a reason they delayed or did not go (ABS Patient Experiences 2024-25).
- In July 2024, 31% of psychologists could not take new clients, and 49% reported waiting lists of 2 to 4 months (APS member poll).
- Under Better Access, people on the lowest incomes waited longer for a first session than people on the highest incomes (Pirkis et al. 2022).
- Longer waits are linked to missed first appointments (Loumidis and Shropshire 1997).
- Digital support used while waiting is seen as useful, but engagement is low unless a person guides it (Huang et al. 2024).

People often do not know about free services that need no referral, do not know what Medicare will pay, and get no clear information while they wait. This tool addresses those three gaps.

## What the tool does

Version 0.5.0 tells one connected story across every page: **Compare, Plan, Share, Wait, Seen**. A journey bar under the menu shows where the person is up to and the next thing to do, on every page.

The guided journey, **Compare my options**, takes about 3 minutes. Each step appears when the person presses Next.

1. **Safety check.** If the person is not safe, crisis numbers are shown at once.
2. **About you.** Age, area, UON student, whether cost is a problem. Every question can be skipped.
3. **Your goal.** When they want to start, and whether they have a GP mental health plan. Options that need a plan get 1 extra week.
4. **Your options.** Typical Hunter options for someone like them (estimated waits; Medicare gap from the real $101.55 rebate). Each can be changed to match a real offer, removed, or added.
5. **6 quick choices.** Paired appointments in the same format as the study's choice tasks. Optionally, the camera shows what the person looks at (see below). If they choose an uncertain option after barely looking at its waiting weeks, the tool asks them to check the latest week first.
6. **Results.** Best match with a plain reason; what a set date, waiting and face to face are worth to them compared with other people; **What caught your eye**; options ranked with the chance of being seen by the goal week; a one-question comprehension check.
7. **Your plan.** Free support to start today, the GP step if needed, questions to ask when calling (based on what matters to them), and what to do if things get worse.
8. **Save and share.** A QR code, WhatsApp, text message, email or the phone's own share menu. The message can be written for the person or for someone who supports them. The plan travels inside the link (`#plan-...`), so nothing is stored online. One button then starts tracking the chosen option.

### How the pages connect

| Page | What it does | Connection |
|---|---|---|
| Home | First visit: start. Return visit: **Welcome back** with their choice, plan and waiting lists | Reads the journey state |
| My waiting lists | Each visit recalculates how long they have waited, the chance of being seen in the next 2 weeks and advice for each stage. Look-ahead slider. WhatsApp update for each list | Filled from the plan, a shared plan, or a clinic QR code |
| Costs | Better Access costs with Medicare benefits from 1 July 2026, the 10-session limit and the private health extras rule | **Use my choice** fills in the fee from the chosen option |
| For clinics | Website statement, 1-SMS message, letter and a **QR code** from a clinic's recent waits | Scanning the QR (`#add-...`) adds that clinic's waiting list, with its real waits, to the person's tracker |
| Shared plan | Read-only view of a plan someone sent | **Track this waiting list** and **Make my own plan** |
| How it works | How the research feeds the tool, privacy, technical details, sources | |
| Urgent help | 000, NSW Mental Health Line, Lifeline, Suicide Call Back Service, 13YARN, Kids Helpline, Beyond Blue | Crisis strip on every page |

The word "simulated" and other technical terms appear only in **Technical details** on the How it works page.

### How the study feeds the tool

| Study component | What it changes in the tool |
|---|---|
| Online choice experiment (200 adults) | Its estimates are the starting point for each person's trade-offs. The person's 6 choices update them (importance weighting over 4,000 draws); the population spread gives the "compared with other people" figures. |
| Eye-tracking and comprehension (40 adults) | Decides the display (picture of weeks first, latest week in orange and in words). The quick check reuses the study's comprehension question. The attention x uncertainty estimate (-0.120 per SD) adjusts a person's weight on uncertainty when their camera is on. |
| Clinics | Turn recent waits into ranges and a QR code. In this prototype the Hunter waits are simulated. |

### Camera eye tracking (optional)

Feasibility: webcam eye tracking in the browser can reach about 1.4 degrees of accuracy (Kaduk et al. 2023, *Behavior Research Methods*); simpler set-ups are around 170 px (Papoutsaki et al. 2016). That is good enough for large areas (When, You pay, How, the week picture), which is all the tool uses.

- Off by default. A consent popup explains: the video never leaves the device, is never recorded, saved or sent, and nobody sees it. Only seconds per screen area are counted.
- Uses Google MediaPipe Face Landmarker (Apache 2.0), downloaded from jsDelivr and Google the first time the camera is turned on (about 4 MB). GPU, then CPU fallback.
- Features: each iris position within its eye, plus nose position. A 9-dot calibration fits a ridge regression to screen position; smoothed gaze points are matched to the `data-aoi` area under them about 30 times a second.
- Small mirrored preview with **Turn off**; optional "Show my gaze" dot. Turns off by itself when the person leaves the 6 choices.
- If the camera or program is not available, the person is told plainly and carries on. On a desktop without the camera, pointer position is used instead (mouse-tracking style) and disclosed in the results.
- WebGazer was not used because it is GPL licensed.

Everything else runs in the browser with no external requests. Answers, plans and waiting lists are saved on the device only (local storage) and can be deleted from How it works.

## Run it

- **Locally:** open `index.html` in a browser. (The camera needs `https` or `localhost`.)
- **GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. The `.nojekyll` file is included. Share links and QR codes point to the address the page is served from.

## Repository structure

```
index.html                      the tool (generated; do not edit by hand)
src/index.template.html         page layout, styles and interface code
src/engine.js                   calculation engine (costs, matching, waiting-list chances, clinic statements,
                                personal trade-offs, share links, gaze calibration, attention)
src/vendor/qrcode.min.js        QR code generator (qrcode-generator 1.4.4, MIT, Kazuhiko Arase)
simulation/simulate_and_estimate.py   simulates the pilot data and runs the planned analyses
simulation/results/estimates.json     model results used by the tool
simulation/results/*_simulated.csv    simulated choice, participant and gaze data
scripts/embed_results.py        builds index.html from the template, engine, QR library and estimates.json
tests/engine.test.mjs           40 tests of the engine and page content (Node 18+)
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
- **Service matching.** A service is shown unless an answer rules it out (age band, area, student-only, hardship-only, mode). Skipped questions never hide a service.
- **Attention.** Seconds on each area are summed across the 6 choices. Waiting share = (When + week picture) / total. With the camera on, spread weight += -0.120 x z, where z is the person's waiting share standardised by the laboratory mean and SD (clipped to plus or minus 2). The check before choosing fires when the chosen uncertain option's waiting areas got under 12% of at least 1.5 seconds of looking (at most twice).
- **Share links.** The plan is compact JSON encoded as URL-safe base64 after `#plan-`; clinic QR codes use `#add-`. Fragments are never sent to a server.
- **Clinic statements.** Empirical percentiles (type 7), rounded up to whole weeks, so a statement never promises a shorter wait than clients had.

## Limits

- The research results are simulated. Service details, phone numbers, hours and Medicare amounts change; they were checked on 28 October 2026 and should be reviewed every 3 months.
- The tool is a research prototype. It was developed with reference to the International Patient Decision Aid Standards, but it has not been evaluated against them.
- It is not a medical device and does not give clinical advice.
- Public release would require user testing and ethics review.

## Developer

Developed by Dr Mesfin Genie, The University of Newcastle, Australia. mesfin.genie@newcastle.edu.au, https://mesfingenie.com

## Licence

MIT. See `LICENSE`. Bundled: qrcode-generator (MIT). Loaded only on camera opt-in: MediaPipe Tasks Vision and Face Landmarker model (Apache 2.0).
