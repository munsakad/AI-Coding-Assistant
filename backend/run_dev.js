// Cross-platform launcher for the backend dev server.
//
// The obvious one-liner ("venv/bin/uvicorn || venv/Scripts/uvicorn.exe")
// works in bash but breaks under npm's default Windows shell (cmd.exe),
// which can't resolve a forward-slash path in the executable position —
// it tries to run a program literally named "venv" and fails. Spawning
// from Node sidesteps shell path parsing entirely, so this one script
// works the same on macOS/Linux/Windows.
const { spawnSync } = require("child_process");
const path = require("path");

const uvicorn = path.join(
  __dirname,
  "venv",
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "uvicorn.exe" : "uvicorn"
);

const result = spawnSync(uvicorn, ["main:app", "--reload", "--port", "8000"], {
  cwd: __dirname,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
