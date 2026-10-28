# Know Your Wait

**Research prototype, version 0.6.0.** A free web tool for people in the Hunter region of NSW who are waiting to see a psychologist. It works on phones, tablets and computers, and helps people:

- compare their options and find out what matters most to them (6 quick choices);
- see where their eyes went while choosing, using the phone or laptop camera (optional, video never leaves the device);
- get a plan, with free support they can start today;
- know what to ask when they call a clinic, and turn the answers into a waiting list and a cost;
- work out what they will pay, with Medicare and health fund rules built in;
- track their waiting list, with a rough guide to the chance of being seen soon.

It also gives clinics a way to describe their waiting times from their own records, including people still waiting, and a QR code that adds their waiting list to a person's tracker.

The tool comes from the University of Newcastle pilot study *Waiting, cost and certainty: preferences for access to psychological care* (CHSF Pilot Research Scheme 2027 application).

> Medicare and service details were checked on 28 October 2026. **The research results in Technical details are simulated** until the study is complete.

## Why

- In 2024-25, 25.3% of people who needed a psychologist said cost was a reason they delayed or did not go (ABS Patient Experiences 2024-25).
- In July 2024, 31% of psychologists could not take new clients, and 49% reported waiting lists of 2 to 4 months (APS member poll).
- Under Better Access, people on the lowest incomes waited longer for a first session than people on the highest incomes (Pirkis et al. 2022).
- Longer waits are linked to missed first appointments (Loumidis and Shropshire 1997).
- Digital support used while waiting is seen as useful, but engagement is low unless a person guides it (Huang et al. 2024).

## One connected journey

A bar under the menu shows 7 stages on every page: **Compare, Plan, Share, Call, Cost, Wait, Seen**. Its "Next" link is worked out from everything saved, for example "Call Smith Psychology: you have waited longer than they said", "Your appointment is in 5 days. Work out the cost" or "Week 6 with Smith Psychology: check in". Every tool page ends with a "Your next step" card, so no page is a dead end.

| Page | What it does | Feeds into |
|---|---|---|
| Compare my options | 8 steps: safety, about you, goal, options (with taking new clients, video or phone, referral, fee, where the wait came from, date checked), 6 choices, results, plan, share | Plan, call questions, costs, tracker |
| Call a clinic | 6 questions (new clients, first-appointment wait, cancellation list, video or phone, fee and bulk billing, what to bring) plus questions tailored to the person's choices. A summary to print or share, with private wording (no health words) | Creates or updates the waiting list; sets the cost as "fee from the practice" |
| Costs | 6 step-by-step questions with a live answer: provider type, face to face, video or phone, Medicare or health fund only or neither, fee (from the practice or a guess), sessions and Medicare sessions used, extras cover. Session-by-session strip showing who pays each session and where the GP review falls. Comparison table and a "what you need" checklist | Home dashboard, ribbon |
| My waiting lists | Time waited, stage, rough-guide chance of being seen in the next 2 weeks, how sure it is, service details, what to do now, look-ahead slider, WhatsApp update, links to call questions and costs. Free support while you wait, including Medicare Mental Health Centres | Ribbon |
| For clinics | Completed waits and people still waiting, Kaplan-Meier curve, website text, SMS, letter, QR code, record sheet | Person's tracker (QR) |
| Shared plan | Read-only plan from a link or QR code | Tracker |

The word "simulated" and other technical terms appear only in Technical details on the How it works page.

## How the research feeds the tool

| Source | Used for | Not used for |
|---|---|---|
| Choice experiment (200 adults) | Starting point for each person's trade-offs; their 6 choices update it. Best match, "what matters to you", tailored questions | Waiting-time probabilities |
| Eye-tracking study (40 adults) | Picture format, latest week in orange and in words, the comprehension check. Live attention shows people where they looked and what to double-check | Changing anyone's weights, best match or ranking |
| Clinic records | Waiting-time statements and the tracker's chances | What people prefer |

The simulated attention x uncertainty estimate (-0.120 per SD, 95% CI -0.195 to -0.045) is shown in Technical details as a hypothesis to test. **The tool does not use it to change recommendations.**

## Camera eye tracking

Works in Chrome, Safari, Edge and Firefox on phones, tablets and computers, on a secure (https) address. Off by default.

- **Consent first.** The popup says the video never leaves the device, is never recorded, saved or sent, nobody sees it, and what is looked at does not change results.
- **Phones.** The face reader runs on the CPU on phones and tablets (more reliable than GPU there) and GPU then CPU on computers, with a switch to CPU if GPU fails during use. The front camera is requested with `facingMode: "user"`; the video element is muted, inline and always rendered, so iOS Safari delivers frames. Frames are processed with `requestVideoFrameCallback` where available. Load times out after 45 seconds with a plain message. In-app browsers that block the camera (Facebook, Instagram, TikTok and others) are detected and the person is told to open the page in Chrome or Safari.
- **Calibration.** 9 dots to tap (each collects up to 10 frames over 1.8 seconds, dropping blinks), then 4 dots that move by themselves to measure accuracy. Result: good, okay or rough, with the average error in pixels. "Redo dots" is always available.
- **Features and model.** MediaPipe Face Landmarker: iris position within each eye (across and up-down), nose position, head turn from the face transformation matrix. Standardised, ridge regression to screen position, smoothed.
- **Focus mode.** While the camera is on, the comparison fills the screen as an A/B table (When, Weeks, You pay, How), so each area is large on a phone.
- **Results.** Share of time on each area; looking style; how often the person chose the option they looked at longer; looks back and forth per choice; how often they checked the week picture; time to choose; a heat table (chosen versus other); a replay of the gaze path for each choice; and "what this changes", which only adds reminders (latest week shown first, a cost step, a video question).
- **Without the camera.** On computers, pointer position is used in the same way and labelled. On phones without the camera, the results offer to redo the 6 choices with the camera.

By default the MediaPipe program comes from jsDelivr and the model from Google. To serve everything from your own site, run `scripts/get_mediapipe.sh`, which puts the files in `vendor/mediapipe/`; the tool uses them automatically when they are there.

## Waiting times: method and validation

- A range a person enters is treated as an equal chance in each week of the range. A typical 4 to 17 weeks is used when the service gave nothing, and labelled as very rough.
- Clinic records use a **Kaplan-Meier** estimate. Waits of people seen are events; people still waiting are censored at the time they have waited so far, so the longest waits are not dropped. The example shows the difference: completed waits alone say half within 6 weeks and 9 in 10 within 11; including the 15 people still waiting gives 7 and 16.
- The chance of a first appointment in the next 2 weeks after waiting w weeks is (S(w) - S(w + 2)) / S(w). The tracker also shows the weeks until half of people who have waited as long are seen.
- These are labelled **rough guide** everywhere, with "How sure is this?" explaining the source. They are not yet validated. Validation needs weekly snapshots of each waiting list, first-appointment dates, people leaving the list, cancellations and clinician hours. At each snapshot, predict each person's 2-week chance and compare with what happened, using calibration bands and the Brier score (`Engine.validateGuide`). The For clinics page lists these records and offers a CSV record sheet.
- The choice study cannot produce these probabilities, because choices between hypothetical appointments say nothing about a clinic's capacity.

## Costs: rules used

- Medicare benefits from 1 July 2026, sessions of 50 minutes or more: psychologist $101.55 (item 80110), clinical psychologist $149.05, mental health social worker or occupational therapist $89.50. A benefit is never more than the fee.
- Up to 10 individual sessions a calendar year with a Mental Health Treatment Plan and a referral from the person's MyMedicare practice or usual GP. The first referral covers up to 6; then a GP review (marked on the session strip).
- Video and phone sessions are covered with the same limits. The same benefit is assumed and the person is told to check the item with the practice.
- **Each session is paid one way:** Medicare, or the health fund, or in full. Extras never top up a Medicare session. Pathways: Medicare first then health fund once Medicare sessions run out; health fund only; neither.
- The result is labelled "Estimate" or "Based on the practice's fee".

## Run it

The tool is a single static file. No build step is needed to use it.

- **Locally:** open `index.html` in a browser. The camera needs `https` or `localhost`.
- **GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. The `.nojekyll` file is included. Share links and QR codes point to the address the page is served from.

Everything runs in the browser. Answers, plans, calls, costs and waiting lists are saved on the device only (local storage) and can be deleted from How it works.

## Repository structure

```
index.html                      the tool (generated; do not edit by hand)
src/index.template.html         page layout, styles and interface code
src/engine.js                   calculation engine: costs, matching, waiting-list chances, Kaplan-Meier,
                                clinic statements, validation, personal trade-offs, share links,
                                gaze calibration, attention summary
src/vendor/qrcode.min.js        QR code generator (qrcode-generator 1.4.4, MIT, Kazuhiko Arase)
scripts/embed_results.py        builds index.html from the template, engine, QR library and estimates.json
scripts/get_mediapipe.sh        optional: self-host the MediaPipe program and model
simulation/simulate_and_estimate.py   simulates the pilot data and runs the planned analyses
simulation/results/             model results and simulated data
tests/engine.test.mjs           48 tests of the engine and page content (Node 18+)
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

- **Waiting lists and costs.** See the two sections above.
- **Personal trade-offs.** Prior for each weight: study estimate, SD 50% of its size (independent normals, wait and cost kept negative), 4,000 seeded draws. Each draw is weighted by the logit probability of the person's answers; the weighted mean gives their weights. Values: set date = 3 x spread / cost; weeks to save $50 = 50 x cost / wait; face to face = video / cost. "Compared with others" uses draws with SD 30%, the simulated spread between people.
- **Service matching.** A service is shown unless an answer rules it out (age band, area, student-only, hardship-only, mode). Skipped questions never hide a service.
- **Attention.** Seconds on each area (When, Weeks, You pay, How, for A and B) are summed per choice, with side switches, time to choose and a gaze path sampled 10 times a second. Attention never changes weights or ranking. The check before choosing fires when the chosen uncertain option's waiting areas got under 12% of at least 1.5 seconds of looking (at most twice). Reminders: latest week shown first if the week picture was checked in fewer than half the choices; a highlighted cost step if cost got under 15% of attention; a video question if How got under 8%.
- **Share links.** The plan is compact JSON encoded as URL-safe base64 after `#plan-`; clinic QR codes use `#add-`. Fragments are never sent to a server.
- **Clinic statements.** Kaplan-Meier quantiles rounded up to whole weeks; when the records never reach a share, the statement says "more than X weeks". A guide is flagged as too thin below 30 completed waits or with no ongoing waits.

## Limits

- The research results are simulated. Service details, phone numbers, hours and Medicare amounts change; they were checked on 28 October 2026 and should be reviewed every 3 months.
- The tool is a research prototype. It was developed with reference to the International Patient Decision Aid Standards, but it has not been evaluated against them.
- It is not a medical device and does not give clinical advice.
- Waiting-time chances are a rough guide until validated against real appointment and waiting-list records.
- Webcam eye tracking is less accurate than laboratory eye tracking, especially on phones and in poor light.
- Public release would require user testing and ethics review.

## Developer

Developed by Dr Mesfin Genie, The University of Newcastle, Australia. mesfin.genie@newcastle.edu.au, https://mesfingenie.com

## Licence

MIT. See `LICENSE`. Bundled: qrcode-generator (MIT). Loaded only on camera opt-in: MediaPipe Tasks Vision and Face Landmarker model (Apache 2.0).
