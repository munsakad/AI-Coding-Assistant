// JS port of backend/model (features.py + network.py + infer.py) so the
// PyTorch bug-risk score runs in the browser. The weights and normalization
// stats are exported from the trained checkpoint by backend/export_web_model.py;
// demo/check-risk-parity.mjs verifies this port against PyTorch in CI.
// No imports or browser APIs, so the parity check can load it under Node.

export const FEATURE_NAMES = [
  "line_count",
  "avg_line_length",
  "max_indent_depth",
  "branch_density",
  "comment_ratio",
  "todo_count",
  "magic_number_density",
  "empty_catch_count",
  "bare_except_count",
  "avg_function_length",
];

const BRANCH_KEYWORDS = ["if", "elif", "else if", "for", "while", "case", "switch", "catch", "except", "&&", "||"];
const COMMENT_PATTERNS = [/\/\/.*/g, /#.*/g, /\/\*[\s\S]*?\*\//g, /"""[\s\S]*?"""/g, /'''[\s\S]*?'''/g];
const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/gi;
const MAGIC_NUMBER_PATTERN = /(?<![\w.])(?!0\b|1\b)\d{2,}(?![\w.])/g;
const EMPTY_CATCH_PATTERN = /(catch|except)[^\n{:]*[{:]\s*(pass|\}|\n\s*\})/gi;
const BARE_EXCEPT_PATTERN = /except\s*:/gi;
const FN_OPENER_PATTERN = /\b(def|function|func|void|public|private|static)\b/g;

const count = (re, s) => (s.match(re) || []).length;
const countSubstring = (s, sub) => s.split(sub).length - 1; // like str.count: non-overlapping

function maxIndentDepth(lines) {
  let max = 0;
  let any = false;
  for (const line of lines) {
    const stripped = line.replace(/^[ \t]+/, "");
    if (!stripped) continue;
    const leading = line.slice(0, line.length - stripped.length);
    const tabs = countSubstring(leading, "\t");
    const depth = tabs + Math.floor((leading.length - tabs) / 2);
    max = any ? Math.max(max, depth) : depth;
    any = true;
  }
  return any ? max : 0;
}

function stripComments(code) {
  let out = code;
  for (const re of COMMENT_PATTERNS) out = out.replace(re, "");
  return out;
}

export function extractFeatures(code) {
  const lines = code.split("\n");
  const lineCount = Math.max(lines.length, 1);
  const avgLineLength = lines.reduce((s, l) => s + l.length, 0) / lineCount;
  const codeOnly = stripComments(code);
  const lower = codeOnly.toLowerCase();
  const branchCount = BRANCH_KEYWORDS.reduce((s, kw) => s + countSubstring(lower, kw), 0);
  const commentChars = code.length - codeOnly.length;
  const fnOpeners = count(FN_OPENER_PATTERN, codeOnly);
  const values = [
    lineCount,
    avgLineLength,
    maxIndentDepth(lines),
    branchCount / lineCount,
    commentChars / Math.max(code.length, 1),
    count(TODO_PATTERN, code),
    count(MAGIC_NUMBER_PATTERN, codeOnly) / lineCount,
    count(EMPTY_CATCH_PATTERN, code),
    count(BARE_EXCEPT_PATTERN, code),
    lineCount / Math.max(fnOpeners, 1),
  ];
  return values.map(Math.fround); // features.py returns float32
}

// BugRiskNet: Linear -> ReLU -> Linear -> ReLU -> Linear -> Sigmoid
function forward(layers, x) {
  let h = x;
  layers.forEach((layer, i) => {
    const out = layer.W.map((row, j) => row.reduce((s, w, k) => s + w * h[k], layer.b[j]));
    h = i < layers.length - 1 ? out.map((v) => (v > 0 ? v : 0)) : out;
  });
  return 1 / (1 + Math.exp(-h[0]));
}

// same output shape as score_risk() in backend/model/infer.py
export function scoreRisk(model, code) {
  const features = extractFeatures(code);
  const x = features.map((v, i) => Math.fround((v - model.mean[i]) / model.std[i]));
  const prob = forward(model.layers, x);
  return {
    risk_score: Math.round(prob * 1000) / 10,
    features: Object.fromEntries(FEATURE_NAMES.map((name, i) => [name, Math.round(features[i] * 1000) / 1000])),
  };
}
