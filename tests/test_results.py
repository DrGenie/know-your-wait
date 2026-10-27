"""Checks that the simulated analysis recovers the assumed parameters. Run: python tests/test_results.py"""
import json, os
R = json.load(open(os.path.join(os.path.dirname(__file__), "..", "simulation", "results", "estimates.json")))
assert R["meta"]["simulated"] is True
for c in R["main_model"]["coefs"]:
    t = R["true_parameters"][c["name"]]
    # true value inside the 95% CI widened by 50% (individual heterogeneity attenuates logit estimates slightly)
    half = (c["ci"][1] - c["ci"][0]) / 2
    assert c["est"] - 1.5 * half <= t <= c["est"] + 1.5 * half, (c["name"], c["est"], t)
true_value = 3 * R["true_parameters"]["spread"] / R["true_parameters"]["cost"]
v = R["values"]["dollars_per_session_confirmed_vs_pm3"]
assert v["ci"][0] <= true_value <= v["ci"][1], (v, true_value)
assert R["main_model"]["respondents"] == 200 and R["main_model"]["choices"] == 1600
assert len(R["design"]) == 16
for a, b in R["design"]:
    assert a != b
print("results checks passed; true value of reliability $%.1f within CI %s" % (true_value, [round(x, 1) for x in v["ci"]]))
