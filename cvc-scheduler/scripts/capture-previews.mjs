import { existsSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "docs", "previews", "latest");
const baseUrl = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000";
const browserExecutable =
  process.env.PREVIEW_BROWSER_EXECUTABLE ??
  [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => existsSync(candidate));

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const jpegOptions = { type: "jpeg", quality: 78, fullPage: true };

const captures = [
  { route: "/admin", fileName: "admin.jpg", viewport: desktopViewport },
  { route: "/admin/dashboard", fileName: "dashboard.jpg", viewport: desktopViewport },
  {
    route: "/admin/announcements",
    fileName: "announcements.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/announcements/templates",
    fileName: "announcement-templates.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/announcements/comm-belgrade-ppe-ready",
    fileName: "announcement-detail-ready.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/needs-attention",
    fileName: "needs-attention.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/food", fileName: "food.jpg", viewport: desktopViewport },
  { route: "/admin/schedule", fileName: "schedule.jpg", viewport: desktopViewport },
  { route: "/admin/settings", fileName: "settings.jpg", viewport: desktopViewport },
  {
    route: "/admin/questionnaires",
    fileName: "questionnaire-review-queue.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/questionnaires/questionnaire-jonah-price-paper",
    fileName: "questionnaire-detail-ready.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/questionnaire/belgrade-remodel-2026",
    fileName: "questionnaire-belgrade.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/projects", fileName: "workspaces.jpg", viewport: desktopViewport },
  { route: "/admin/projects/new", fileName: "new-workspace.jpg", viewport: desktopViewport },
  {
    route: "/admin/projects/belgrade-remodel-2026",
    fileName: "belgrade-workspace-detail.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/volunteers", fileName: "volunteers.jpg", viewport: desktopViewport },
  {
    route: "/admin/volunteers/alex-rivera",
    fileName: "volunteer-profile-alex-rivera.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/dashboard", fileName: "mobile-dashboard.jpg", viewport: mobileViewport },
  {
    route: "/admin/announcements",
    fileName: "mobile-announcements.jpg",
    viewport: mobileViewport,
  },
  {
    route: "/admin/announcements/templates",
    fileName: "mobile-announcement-templates.jpg",
    viewport: mobileViewport,
  },
  { route: "/admin/food", fileName: "mobile-food.jpg", viewport: mobileViewport },
  {
    route: "/admin/announcements",
    fileName: "mobile-admin-drawer-open.jpg",
    viewport: mobileViewport,
    openMobileDrawer: true,
  },
  {
    route: "/questionnaire/belgrade-remodel-2026",
    fileName: "mobile-questionnaire-belgrade.jpg",
    viewport: mobileViewport,
  },
];

function previewUrl(route) {
  return new URL(route, baseUrl).toString();
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch(
    browserExecutable ? { executablePath: browserExecutable } : {},
  );
  const page = await browser.newPage({ viewport: desktopViewport });

  try {
    for (const { route, fileName, viewport, openMobileDrawer } of captures) {
      await page.setViewportSize(viewport);

      const response = await page.goto(previewUrl(route), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      if (!response?.ok()) {
        throw new Error(`Failed to load ${route}: ${response?.status() ?? "no response"}`);
      }

      if (openMobileDrawer) {
        await page.getByRole("button", { name: "Open admin navigation" }).click();
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
