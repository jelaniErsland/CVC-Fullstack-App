import { existsSync } from "node:fs";
import { chromium } from "playwright";

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
const projectWeekLabel = "Jan 12 to Jan 18, 2026";
const nextWeekLabel = "Jan 19 to Jan 25, 2026";
const weekItemLabel =
  "Gate attendant, 1 of 1 volunteers, Tue Jan 13, 7:30 AM - 10:30 AM";
const listItemLabel =
  "Site support week, Project window · Mon Jan 12 through Sat Jan 17, 2 of 3 helpers, General Volunteers";
const monthItemLabel =
  "Room signage labels, 1 of 2 volunteers, Thu Jan 15, 10:00 AM - 12:00 PM";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function step(label, action) {
  try {
    await action();
    console.log(`✓ ${label}`);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function calendarUrl() {
  return new URL("/admin/calendar", baseUrl).toString();
}

function watchPageErrors(page) {
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });
  page.on("console", (message) => {
    const text = message.text();
    const isHydrationWarning =
      /hydration|hydrated|server rendered html didn't match/i.test(text);

    if (message.type() === "error" || isHydrationWarning) {
      failures.push(`console ${message.type()}: ${text}`);
    }
  });

  return failures;
}

async function loadCalendar(page) {
  const response = await page.goto(calendarUrl(), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  assert(response?.ok(), `Calendar returned ${response?.status() ?? "no response"}`);
  await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  await page.getByRole("button", { name: "Week", exact: true }).waitFor();
  await page.waitForTimeout(100);
}

async function assertUnique(locator, label) {
  const count = await locator.count();
  assert(count === 1, `${label} expected one match, found ${count}`);
  return locator;
}

async function selectView(page, view) {
  const button = await assertUnique(
    page.getByRole("button", { name: view, exact: true }),
    `${view} view button`,
  );

  await button.click();
  await page.waitForFunction(
    (viewLabel) =>
      Array.from(
        document.querySelectorAll('[aria-label="Calendar view"] button'),
      ).some(
        (candidate) =>
          candidate.textContent?.trim() === viewLabel &&
          candidate.getAttribute("aria-pressed") === "true",
      ),
    view,
  );
  assert(
    (await button.getAttribute("aria-pressed")) === "true",
    `${view} did not expose aria-pressed=true`,
  );
}

async function assertPeriod(page, label) {
  await page.getByRole("heading", { name: label, exact: true }).waitFor();
}

async function waitForFocusLabel(page, label) {
  await page.waitForFunction(
    (expectedLabel) =>
      document.activeElement?.getAttribute("aria-label") === expectedLabel,
    label,
  );
}

async function visibleCalendarSurfaceCount(page) {
  return page.evaluate(() => {
    const closeLabels = [
      "Close calendar filters",
      "Close project work planner",
      "Close calendar item inspector",
    ];
    const activePanels = closeLabels.filter((label) =>
      Array.from(document.querySelectorAll(`[aria-label="${label}"]`)).some(
        (control) => !control.closest("[inert]"),
      ),
    ).length;
    const moreOpen = document.querySelector(
      '[aria-label="More admin navigation"]',
    );

    return activePanels + (moreOpen ? 1 : 0);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert(!hasOverflow, `${label} has document horizontal overflow`);
}

async function closeWithEscape(page, dialogName, triggerLabel) {
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: dialogName, exact: true })
    .waitFor({ state: "hidden" });
  await waitForFocusLabel(page, triggerLabel);
  assert(
    (await visibleCalendarSurfaceCount(page)) === 0,
    `${dialogName} did not leave a clean Calendar surface`,
  );
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: desktopViewport });
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  page.setDefaultTimeout(7_500);

  try {
    await step("desktop Calendar loads", async () => {
      await loadCalendar(page);
      await assertPeriod(page, projectWeekLabel);
      await assertNoHorizontalOverflow(page, "Desktop Calendar");
    });

    await step("desktop Day/Week/Month/List switching", async () => {
      await selectView(page, "Day");
      await page
        .getByRole("button", {
          name: "Plan project work on Tue Jan 13 at 1 PM",
          exact: true,
        })
        .waitFor();

      await selectView(page, "Week");
      await page
        .getByRole("region", {
          name: "Project context and date-based work",
          exact: true,
        })
        .waitFor();

      await selectView(page, "Month");
      await page
        .getByRole("button", { name: "Plan project work on Wed Jan 14", exact: true })
        .waitFor();

      await selectView(page, "List");
      await page.getByTestId("calendar-list-view").waitFor();
    });

    await step("desktop List navigation and Project week reset", async () => {
      const next = await assertUnique(
        page.getByRole("button", { name: "Next week", exact: true }),
        "Next week button",
      );
      await next.click();
      await assertPeriod(page, nextWeekLabel);

      const reset = await assertUnique(
        page.getByRole("button", { name: "Project week", exact: true }),
        "Project week button",
      );
      assert(await reset.isEnabled(), "Project week should be enabled after navigation");
      await reset.click();
      await assertPeriod(page, projectWeekLabel);
    });

    await step("desktop filters focus, filter to Food, and close", async () => {
      const trigger = await assertUnique(
        page.getByRole("button", { name: "Open calendar filters", exact: true }),
        "Calendar filters trigger",
      );
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Filters should be the only active Calendar surface",
      );

      await dialog.getByRole("button", { name: "Food", exact: true }).click();
      await dialog
        .getByRole("button", { name: "Show results (1)", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await waitForFocusLabel(page, "Open calendar filters");
      await page.getByText("4 visible items - Food", { exact: true }).waitFor();
      assert(
        (await page
          .locator('[data-testid="calendar-list-view"] [role="listitem"] > button')
          .count()) === 4,
        "Food filter should leave four List rows",
      );
      await page.getByRole("button", { name: "Reset", exact: true }).click();
    });

    await step("desktop item inspector focus and Escape restoration", async () => {
      await selectView(page, "Week");
      const trigger = await assertUnique(
        page.getByRole("button", { name: weekItemLabel, exact: true }),
        "Week event button",
      );
      await trigger.click();
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      await closeWithEscape(page, "Calendar item inspector", weekItemLabel);
    });

    await step("desktop Day creation defaults and focus restoration", async () => {
      await selectView(page, "Day");
      const triggerLabel = "Plan project work on Tue Jan 13 at 1 PM";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Day creation target",
      );
      await trigger.click();
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await planner
        .getByText("Suggested Tuesday, Jan 13, 1 PM to 2 PM. Adjust below.", {
          exact: true,
        })
        .waitFor();
      assert(
        (await planner.getByLabel("Start", { exact: true }).getAttribute("value")) ===
          "13:00",
        "Day creation should default Start to 13:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).getAttribute("value")) ===
          "14:00",
        "Day creation should default End to 14:00",
      );
      await closeWithEscape(page, "Plan project work", triggerLabel);
    });

    await step("desktop Month populated cell creation and event inspection", async () => {
      await selectView(page, "Month");
      const event = await assertUnique(
        page.getByRole("button", { name: monthItemLabel, exact: true }),
        "Month event chip",
      );
      await event.click();
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await closeWithEscape(page, "Calendar item inspector", monthItemLabel);

      const triggerLabel = "Plan project work on Thu Jan 15";
      const background = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Populated Month background",
      );
      const backgroundBounds = await background.boundingBox();
      assert(backgroundBounds, "Populated Month background has no bounds");
      await background.click({
        position: {
          x: backgroundBounds.width / 2,
          y: backgroundBounds.height - 8,
        },
      });
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      assert(
        (await planner.getByLabel("Date", { exact: true }).getAttribute("value")) ===
          "2026-01-15",
        "Month creation should keep Jan 15",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).getAttribute("value")) ===
          "09:00",
        "Month creation should default Start to 09:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).getAttribute("value")) ===
          "10:00",
        "Month creation should default End to 10:00",
      );
      await closeWithEscape(page, "Plan project work", triggerLabel);
    });

    await step("desktop List rows reuse inspector without nested controls", async () => {
      await selectView(page, "List");
      const nestedControls = await page
        .locator(
          '[data-testid="calendar-list-view"] button button, [data-testid="calendar-list-view"] button a, [data-testid="calendar-list-view"] a button',
        )
        .count();
      assert(nestedControls === 0, `List contains ${nestedControls} nested controls`);

      const trigger = await assertUnique(
        page.getByRole("button", { name: listItemLabel, exact: true }),
        "List row",
      );
      await trigger.click();
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await closeWithEscape(page, "Calendar item inspector", listItemLabel);
    });

    await step("desktop has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: mobileViewport });
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  page.setDefaultTimeout(7_500);

  try {
    await step("mobile Calendar and emphasized bottom navigation load", async () => {
      await loadCalendar(page);
      const navigation = page.getByRole("navigation", {
        name: "Primary admin navigation",
        exact: true,
      });
      await navigation.waitFor();
      const calendarTab = navigation.getByRole("link", {
        name: "Open Calendar",
        exact: true,
      });
      await calendarTab.waitFor();
      const className = await calendarTab.getAttribute("class");
      assert(
        className?.includes("-translate-y-2") && className.includes("bg-slate-950"),
        "Mobile Calendar tab is not emphasized and active",
      );
      await assertNoHorizontalOverflow(page, "Mobile Calendar");
    });

    await step("mobile view controls fit and switch", async () => {
      const controlAudit = await page.evaluate(() => {
        const group = document.querySelector('[aria-label="Calendar view"]');
        const buttons = group ? Array.from(group.querySelectorAll("button")) : [];
        const bounds = group?.getBoundingClientRect();

        return {
          buttonCount: buttons.length,
          fitsViewport: Boolean(
            bounds && bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth,
          ),
        };
      });
      assert(controlAudit.buttonCount === 4, "Mobile should expose four view controls");
      assert(controlAudit.fitsViewport, "Mobile view controls exceed the viewport");

      for (const view of ["Day", "Week", "Month", "List"]) {
        await selectView(page, view);
      }
      await selectView(page, "Week");
      await assertNoHorizontalOverflow(page, "Mobile view controls");
    });

    await step("mobile More opens alone and closes", async () => {
      await page
        .getByRole("button", { name: "Open more admin navigation", exact: true })
        .click();
      const more = page.getByRole("region", {
        name: "More admin navigation",
        exact: true,
      });
      await more.waitFor();
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile More should be the only active surface",
      );
      await more
        .getByRole("button", { name: "Close more admin navigation", exact: true })
        .click();
      await more.waitFor({ state: "hidden" });
    });

    await step("mobile filters open as the only sheet", async () => {
      const trigger = page.getByRole("button", {
        name: "Open calendar filters",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile filters should not stack with More or another dialog",
      );
      await closeWithEscape(page, "Calendar filters", "Open calendar filters");
    });

    await step("mobile item opens the inspector sheet alone", async () => {
      const trigger = page.getByRole("button", { name: weekItemLabel, exact: true });
      await trigger.click();
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile inspector should be the only active surface",
      );
      await closeWithEscape(page, "Calendar item inspector", weekItemLabel);
    });

    await step("mobile creation sheet opens alone and restores focus", async () => {
      const triggerLabel = "Plan project work on Mon Jan 12";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Mobile Week creation target",
      );
      await trigger.click();
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile creation should be the only active surface",
      );
      await planner.getByText("Suggested from calendar day", { exact: true }).waitFor();
      await closeWithEscape(page, "Plan project work", triggerLabel);
    });

    await step("mobile has no overflow or browser errors", async () => {
      await assertNoHorizontalOverflow(page, "Mobile Calendar after interactions");
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch(
    browserExecutable ? { executablePath: browserExecutable } : {},
  );

  try {
    console.log(`Calendar regression target: ${calendarUrl()}`);
    await runDesktop(browser);
    await runMobile(browser);
  } finally {
    await browser.close();
  }

  console.log("Calendar interaction regression passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
