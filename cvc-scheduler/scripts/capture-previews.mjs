import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "docs", "previews", "latest");
const baseUrl = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000";

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const jpegOptions = { type: "jpeg", quality: 78, fullPage: true };

const captures = [
  ["/admin", "admin.jpg", desktopViewport],
  ["/admin/dashboard", "dashboard.jpg", desktopViewport],
  ["/admin/projects", "workspaces.jpg", desktopViewport],
  ["/admin/projects/new", "new-workspace.jpg", desktopViewport],
  [
    "/admin/projects/belgrade-remodel-2026",
    "belgrade-workspace-detail.jpg",
    desktopViewport,
  ],
  ["/admin/settings", "settings.jpg", desktopViewport],
  ["/admin/volunteers", "volunteers.jpg", desktopViewport],
  [
    "/admin/volunteers/alex-rivera",
    "volunteer-profile-alex-rivera.jpg",
    desktopViewport,
  ],
  [
    "/questionnaire/belgrade-remodel-2026",
    "questionnaire-belgrade.jpg",
    desktopViewport,
  ],
  ["/admin/dashboard", "mobile-dashboard.jpg", mobileViewport],
  [
    "/questionnaire/belgrade-remodel-2026",
    "mobile-questionnaire-belgrade.jpg",
    mobileViewport,
  ],
];

function previewUrl(route) {
  return new URL(route, baseUrl).toString();
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: desktopViewport });

  try {
    for (const [route, fileName, viewport] of captures) {
      await page.setViewportSize(viewport);

      const response = await page.goto(previewUrl(route), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      if (!response?.ok()) {
        throw new Error(`Failed to load ${route}: ${response?.status() ?? "no response"}`);
      }

      await page.screenshot({
        ...jpegOptions,
        path: path.join(outputDir, fileName),
      });

      console.log(`Saved ${fileName}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Preview screenshots saved to ${path.relative(projectRoot, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
