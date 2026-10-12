"""
Exports the trained bug-risk model for the static GitHub Pages demo.

Writes <out>/risk-model.json (layer weights + the feature mean/std saved by
train.py) and <out>/risk-parity.json (score_risk() output for sample snippets,
which frontend/demo/check-risk-parity.mjs compares against the JS port).

Usage (from backend/, after running train.py):
    python export_web_model.py ../frontend/public/demo
"""

import json
import sys
from pathlib import Path

import torch

from model.infer import WEIGHTS_PATH, score_risk

SAMPLES = [
    "def add(a, b):\n    return a + b\n",
    'def load(path):\n    try:\n        with open(path) as f:\n            return f.read()\n    except:\n        pass\n',
    "function total(items) {\n  let t = 0;\n  for (let i = 0; i < items.length; i++) {\n    if (items[i].price > 100) {\n      if (items[i].qty > 20) {\n        t += items[i].price * 0.85;\n      } else {\n        t += items[i].price;\n      }\n    }\n  }\n  return t;\n}\n",
    "// TODO: handle retries\nasync function fetchUser(id) {\n  try {\n    const res = await fetch('/api/users/' + id);\n    return await res.json();\n  } catch (e) {}\n}\n",
    "#include <stdio.h>\n/* compute factorial */\nint fact(int n) {\n    if (n <= 1) return 1;\n    return n * fact(n - 1);\n}\nint main(void) {\n    printf(\"%d\\n\", fact(10));\n    return 0;\n}\n",
    "public class Timer {\n    private static final int TIMEOUT = 3000;\n    public void run() {\n        while (true) {\n            switch (state) {\n                case 42: handle(); break;\n                case 7: retry(500); break;\n                default: break;\n            }\n        }\n    }\n}\n",
    "\"\"\"Utility helpers.\"\"\"\n\n# FIXME: slow for big inputs\ndef dedupe(xs):\n    out = []\n    for x in xs:\n        if x not in out:\n            out.append(x)\n    return out\n",
    "func Sum(nums []int) int {\n\ttotal := 0\n\tfor _, n := range nums {\n\t\tif n > 255 && n < 1024 || n == 99 {\n\t\t\ttotal += n\n\t\t}\n\t}\n\treturn total\n}\n",
]


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    checkpoint = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=False)
    state = checkpoint["state_dict"]
    layers = [
        {"W": state[f"net.{i}.weight"].double().tolist(), "b": state[f"net.{i}.bias"].double().tolist()}
        for i in (0, 2, 4)
    ]
    model = {
        "mean": [float(v) for v in checkpoint["mean"]],
        "std": [float(v) for v in checkpoint["std"]],
        "layers": layers,
    }
    parity = [{"code": code, **score_risk(code)} for code in SAMPLES]

    (out / "risk-model.json").write_text(json.dumps(model))
    (out / "risk-parity.json").write_text(json.dumps(parity, indent=1))
    print("risk scores:", [p["risk_score"] for p in parity])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "../frontend/public/demo")
