import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { resolvePreviewBaseUrl } from "./preview-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseUrl = resolvePreviewBaseUrl();

function isLoopbackUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/\/v\/access\/[A-Za-z0-9_-]{32,}/g, "/v/access/[redacted]")
    .replace(/sb-[A-Za-z0-9_-]+-auth-token[^\\s]*/g, "sb-[redacted]-auth-token");
}

function run(commandName, args, label) {
  const executable = process.platform === "win32" && commandName === "npm"
    ? process.execPath
    : commandName;
  const executableArgs = process.platform === "win32" && commandName === "npm"
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PREVIEW_BASE_URL: baseUrl,
    },
    windowsHide: true,
  });
  if (result.status !== 0) {
    const output = redact(`${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`).slice(0, 4000);
    throw new Error(`${label} failed.\n${output}`);
  }
  return redact(result.stdout);
}

async function main() {
  assert(isLoopbackUrl(baseUrl), "Bozeman beta UI validation accepts only loopback production preview URLs.");

  const checks = [
    {
      label: "Calendar desktop/mobile persisted scheduling loop",
      command: ["npm", ["run", "test:calendar"]],
      requiredOutput: "Calendar interaction regression passed.",
    },
    {
      label: "Persisted Volunteers desktop/mobile Add/Edit",
      command: ["npm", ["run", "test:volunteer-profile-management:browser"]],
      requiredOutput: "Volunteer profile management browser validation passed.",
    },
    {
      label: "Volunteer schedule desktop/mobile response loop",
      command: ["npm", ["run", "test:volunteer-schedule-responses:browser"]],
      requiredOutput: "Validated browser Confirm/Deny",
    },
  ];

  for (const check of checks) {
    const output = run(check.command[0], check.command[1], check.label);
    assert(output.includes(check.requiredOutput), `${check.label} did not report its expected pass marker.`);
  }

  console.log("Bozeman beta UI browser validation passed.");
  console.log("Covered Calendar create/edit/preset/assign/publish/email states, persisted Volunteers Add/Edit, volunteer schedule Confirm/Deny/Confirm All, desktop and 390px mobile checks through focused browser suites.");
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
