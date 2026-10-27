"""Build index.html from src/index.template.html, src/engine.js and simulation/results/estimates.json."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, "simulation", "results", "estimates.json")) as f:
    res = json.load(f)
res.pop("design", None)  # the web tool does not need the design matrix
payload = json.dumps(res, separators=(",", ":")).replace("</", "<\\/")
with open(os.path.join(ROOT, "src", "index.template.html")) as f:
    html = f.read()
assert "/*RESULTS_JSON*/" in html and "/*ENGINE*/" in html
with open(os.path.join(ROOT, "src", "engine.js")) as f:
    html = html.replace("/*ENGINE*/", f.read())
with open(os.path.join(ROOT, "index.html"), "w") as f:
    f.write(html.replace("/*RESULTS_JSON*/", payload))
print("index.html written,", len(html) // 1024, "KB template")
