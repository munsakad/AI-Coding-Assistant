// CI check: the browser port of the bug-risk model must reproduce PyTorch's
// score_risk() output (score and feature readout) on the sample snippets.
// Usage: node demo/check-risk-parity.mjs <dir with risk-model.json + risk-parity.json>
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || "public/demo";
const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const source = readFileSync(new URL("./overrides/src/demo/riskModel.js", import.meta.url), "utf8");
const { scoreRisk } = await import("data:text/javascript," + encodeURIComponent(source));

const model = read("risk-model.json");
let failures = 0;
for (const sample of read("risk-parity.json")) {
  const js = scoreRisk(model, sample.code);
  const featureDiffs = Object.entries(sample.features).filter(([k, v]) => Math.abs(js.features[k] - v) > 1e-3);
  const ok = Math.abs(js.risk_score - sample.risk_score) <= 0.2 && featureDiffs.length === 0;
  const label = sample.code.split("\n")[0].slice(0, 40);
  console.log((ok ? "ok   " : "FAIL ") + label.padEnd(42) + " py=" + sample.risk_score + " js=" + js.risk_score);
  if (!ok) {
    failures += 1;
    for (const [k, v] of featureDiffs) console.log("     " + k + ": py=" + v + " js=" + js.features[k]);
  }
}
if (failures) {
  console.error(failures + " sample(s) diverged from PyTorch");
  process.exit(1);
}
console.log("JS risk model matches PyTorch");
