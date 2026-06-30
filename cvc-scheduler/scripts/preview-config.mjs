import { existsSync } from "node:fs";

export const defaultPreviewBaseUrl = "http://127.0.0.1:3000";

const knownBrowserExecutables = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function resolvePreviewBaseUrl(
  configuredBaseUrl = process.env.PREVIEW_BASE_URL,
) {
  const candidate = configuredBaseUrl?.trim() || defaultPreviewBaseUrl;

  let parsedUrl;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error(
      `Invalid PREVIEW_BASE_URL "${candidate}". Use an absolute http(s) URL, for example ${defaultPreviewBaseUrl}.`,
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      `Invalid PREVIEW_BASE_URL protocol "${parsedUrl.protocol}". Use http: or https:.`,
    );
  }

  return parsedUrl.toString();
}

export function resolvePreviewBrowserExecutable(
  configuredExecutable = process.env.PREVIEW_BROWSER_EXECUTABLE,
) {
  return (
    configuredExecutable?.trim() ||
    knownBrowserExecutables.find((candidate) => existsSync(candidate))
  );
}

export function createPreviewUrl(baseUrl, route) {
  return new URL(route, baseUrl).toString();
}
