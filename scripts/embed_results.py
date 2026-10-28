"""Build index.html from src/index.template.html, src/engine.js, src/vendor/qrcode.min.js
and simulation/results/estimates.json."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(ROOT, *p), encoding="utf-8").read()
res = json.loads(read("simulation", "results", "estimates.json"))
res.pop("design", None)  # the web tool does not need the design matrix
payload = json.dumps(res, separators=(",", ":")).replace("</", "<\\/")
html = read("src", "index.template.html")
for k in ("/*RESULTS_JSON*/", "/*ENGINE*/", "/*QRLIB*/"):
    assert k in html, k
qr = read("src", "vendor", "qrcode.min.js").replace("</", "<\\/")
html = html.replace("/*QRLIB*/", qr).replace("/*ENGINE*/", read("src", "engine.js"))
html = html.replace("/*RESULTS_JSON*/", payload)
with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)
print("index.html written,", len(html) // 1024, "KB")
