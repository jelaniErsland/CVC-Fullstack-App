import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/calendar-regression.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    PROJECT_DAY_QUICK_VIEW_ONLY: "1",
  },
  maxBuffer: 20 * 1024 * 1024,
  windowsHide: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
