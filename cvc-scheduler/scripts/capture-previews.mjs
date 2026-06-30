import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "docs", "previews", "latest");
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const jpegOptions = { type: "jpeg", quality: 78, fullPage: true };
const requestedCaptureFiles = new Set(
  (process.env.PREVIEW_CAPTURE_FILES ?? "")
    .split(",")
    .map((fileName) => fileName.trim())
    .filter(Boolean),
);

const captures = [
  { route: "/admin", fileName: "admin.jpg", viewport: desktopViewport },
  { route: "/admin/dashboard", fileName: "dashboard.jpg", viewport: desktopViewport },
  {
    route: "/admin/announcements",
    fileName: "communications.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/announcements/templates",
    fileName: "communications-templates.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/announcements/comm-belgrade-ppe-ready",
    fileName: "communications-detail-ready.jpg",
    viewport: desktopViewport,
  },
  {
    route: "/admin/needs-attention",
    fileName: "needs-attention.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/calendar", fileName: "calendar.jpg", viewport: desktopViewport },
  {
    route: "/admin/calendar",
    fileName: "calendar-day.jpg",
    viewport: desktopViewport,
    calendarView: "Day",
  },
  {
    route: "/admin/calendar",
    fileName: "calendar-month.jpg",
    viewport: desktopViewport,
    calendarView: "Month",
  },
  {
    route: "/admin/calendar",
    fileName: "calendar-list.jpg",
    viewport: desktopViewport,
    calendarView: "List",
  },
  {
    route: "/admin/calendar",
    fileName: "calendar-filter-open.jpg",
    viewport: desktopViewport,
    openCalendarFilters: true,
  },
  {
    route: "/admin/calendar",
    fileName: "calendar-create-open.jpg",
    viewport: desktopViewport,
    openCalendarCreate: true,
    calendarCreateLabel:
      "Plan project work on Sun, Jan 18 in the Week time grid; keyboard default 9 AM",
  },
  { route: "/admin/tasks", fileName: "tasks.jpg", viewport: desktopViewport },
  { route: "/admin/food", fileName: "food.jpg", viewport: desktopViewport },
  {
    route: "/admin/food/food-belgrade-lunch-jan-14",
    fileName: "food-detail-lunch-jan-14.jpg",
    viewport: desktopViewport,
  },
  { route: "/admin/security", fileName: "security.jpg", viewport: desktopViewport },
  {
    route: "/admin/security/security-belgrade-evening-jan-12",
    fileName: "security-detail-evening-jan-12.jpg",
    viewport: desktopViewport,
  },
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
    fileName: "mobile-communications.jpg",
    viewport: mobileViewport,
  },
  {
    route: "/admin/announcements/templates",
    fileName: "mobile-communications-templates.jpg",
    viewport: mobileViewport,
  },
  { route: "/admin/tasks", fileName: "mobile-tasks.jpg", viewport: mobileViewport },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar.jpg",
    viewport: mobileViewport,
    focusCalendarWorkspace: true,
  },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar-day.jpg",
    viewport: mobileViewport,
    calendarView: "Day",
  },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar-month.jpg",
    viewport: mobileViewport,
    calendarView: "Month",
    focusCalendarWorkspace: true,
  },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar-list.jpg",
    viewport: mobileViewport,
    calendarView: "List",
    focusCalendarWorkspace: true,
  },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar-filter-open.jpg",
    viewport: mobileViewport,
    openCalendarFilters: true,
  },
  {
    route: "/admin/calendar",
    fileName: "mobile-calendar-create-open.jpg",
    viewport: mobileViewport,
    openCalendarCreate: true,
    calendarCreateLabel: "Plan project work on Sun Jan 18",
  },
  { route: "/admin/volunteers", fileName: "mobile-volunteers.jpg", viewport: mobileViewport },
  { route: "/admin/food", fileName: "mobile-food.jpg", viewport: mobileViewport },
  {
    route: "/admin/food/food-belgrade-lunch-jan-14",
    fileName: "mobile-food-detail-lunch-jan-14.jpg",
    viewport: mobileViewport,
  },
  { route: "/admin/security", fileName: "mobile-security.jpg", viewport: mobileViewport },
  {
    route: "/admin/security/security-belgrade-evening-jan-12",
    fileName: "mobile-security-detail-evening-jan-12.jpg",
    viewport: mobileViewport,
  },
  {
    route: "/admin/announcements",
    fileName: "mobile-admin-drawer-open.jpg",
    viewport: mobileViewport,
    openMobileDrawer: true,
  },
  {
    route: "/admin/dashboard",
    fileName: "mobile-more-menu-open.jpg",
    viewport: mobileViewport,
    openMobileMore: true,
  },
  {
    route: "/questionnaire/belgrade-remodel-2026",
    fileName: "mobile-questionnaire-belgrade.jpg",
    viewport: mobileViewport,
  },
];

function previewUrl(route) {
  return createPreviewUrl(baseUrl, route);
}

async function main() {
  const selectedCaptures =
    requestedCaptureFiles.size > 0
      ? captures.filter(({ fileName }) => requestedCaptureFiles.has(fileName))
      : captures;

  if (requestedCaptureFiles.size > 0) {
    const selectedFileNames = new Set(
      selectedCaptures.map(({ fileName }) => fileName),
    );
    const missingFileNames = [...requestedCaptureFiles].filter(
      (fileName) => !selectedFileNames.has(fileName),
    );

    if (missingFileNames.length > 0) {
      throw new Error(`Unknown preview file${missingFileNames.length === 1 ? "" : "s"}: ${missingFileNames.join(", ")}`);
    }
  } else {
    await rm(outputDir, { recursive: true, force: true });
  }

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch(
    browserExecutable ? { executablePath: browserExecutable } : {},
  );
  const page = await browser.newPage({ viewport: desktopViewport });

  try {
    for (const {
      route,
      fileName,
      viewport,
      calendarView,
      calendarCreateLabel,
      focusCalendarWorkspace,
      openCalendarCreate,
      openCalendarFilters,
      openMobileDrawer,
      openMobileMore,
    } of selectedCaptures) {
      await page.setViewportSize(viewport);

      const response = await page.goto(previewUrl(route), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      if (!response?.ok()) {
        throw new Error(`Failed to load ${route}: ${response?.status() ?? "no response"}`);
      }

      if (calendarView) {
        const calendarViewButton = page.getByRole("button", {
          name: calendarView,
          exact: true,
        });

        await page.waitForTimeout(200);
        await calendarViewButton.click();
        await page.waitForFunction(
          (viewLabel) =>
            Array.from(
              document.querySelectorAll('[aria-label="Calendar view"] button'),
            ).some(
              (button) =>
                button.textContent?.trim() === viewLabel &&
                button.getAttribute("aria-pressed") === "true",
            ),
          calendarView,
        );
        await page.waitForTimeout(200);
      }

      if (openMobileDrawer) {
        await page.getByRole("button", { name: "Open navigation menu" }).click();
      }

      if (openMobileMore) {
        await page.getByRole("button", { name: "Open more admin navigation" }).click();
      }

      if (openCalendarFilters) {
        await page.getByRole("button", { name: "Open calendar filters" }).click();
        await page.waitForTimeout(200);
      }

      if (openCalendarCreate) {
        await page
          .getByRole("button", { name: calendarCreateLabel, exact: true })
          .click();
        await page.waitForTimeout(200);
      }

      if (focusCalendarWorkspace) {
        await page.getByTestId("calendar-workspace-header").evaluate((element) => {
          element.scrollIntoView({ block: "start" });
        });

        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );

        if (hasHorizontalOverflow) {
          throw new Error("Mobile Calendar has horizontal overflow at 390px");
        }
      }

      await page.screenshot({
        ...jpegOptions,
        fullPage: viewport.width >= 1024,
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
