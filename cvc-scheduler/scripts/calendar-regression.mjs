import { chromium } from "playwright";
import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const projectWeekLabel = "Jan 12 to Jan 18, 2026";
const nextWeekLabel = "Jan 19 to Jan 25, 2026";
// Accessible names are the deliberate interaction contract for the fixed Belgrade mock.
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

function calendarUrl() {
  return createPreviewUrl(baseUrl, "/admin/calendar");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function collectPageDiagnostics(page) {
  if (page.isClosed()) {
    return "Page diagnostics: page already closed";
  }

  try {
    const state = await page.evaluate(() => {
      const activeElement = document.activeElement;
      const activeDescription = activeElement
        ? [
            activeElement.tagName.toLowerCase(),
            activeElement.getAttribute("role"),
            activeElement.getAttribute("aria-label"),
            activeElement.textContent?.trim().replace(/\s+/g, " ").slice(0, 80),
          ]
            .filter(Boolean)
            .join(" | ")
        : "none";
      const pressedView = Array.from(
        document.querySelectorAll('[aria-label="Calendar view"] button'),
      ).find((button) => button.getAttribute("aria-pressed") === "true");
      const activeDialogs = Array.from(
        document.querySelectorAll('[role="dialog"]'),
      )
        .filter((dialog) => !dialog.closest("[inert]"))
        .map(
          (dialog) =>
            dialog.getAttribute("aria-label") ||
            dialog.getAttribute("aria-labelledby") ||
            "unnamed dialog",
        );

      return {
        activeDescription,
        activeDialogs,
        pressedView: pressedView?.textContent?.trim() || "none",
      };
    });
    const viewport = page.viewportSize();

    return [
      `URL: ${page.url()}`,
      `Viewport: ${viewport ? `${viewport.width}x${viewport.height}` : "unknown"}`,
      `Pressed view: ${state.pressedView}`,
      `Active element: ${state.activeDescription}`,
      `Active dialogs: ${state.activeDialogs.join(", ") || "none"}`,
    ].join("\n");
  } catch (error) {
    return `Page diagnostics unavailable: ${errorMessage(error)}`;
  }
}

function createStepRunner(scope, page) {
  return async function step(label, action) {
    const startedAt = performance.now();

    try {
      await action();
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.log(`[PASS] ${scope}: ${label} (${elapsedMs}ms)`);
    } catch (error) {
      const diagnostics = await collectPageDiagnostics(page);

      throw new Error(
        `[FAIL] ${scope}: ${label}\n${errorMessage(error)}\n${diagnostics}`,
        { cause: error },
      );
    }
  };
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

  const viewStates = await page
    .locator('[aria-label="Calendar view"] button')
    .evaluateAll((buttons) =>
      buttons.map((candidate) => ({
        label: candidate.textContent?.trim(),
        pressed: candidate.getAttribute("aria-pressed"),
      })),
    );
  const pressedViews = viewStates
    .filter(({ pressed }) => pressed === "true")
    .map(({ label }) => label);

  assert(viewStates.length === 4, `Expected four Calendar views, found ${viewStates.length}`);
  assert(
    pressedViews.length === 1 && pressedViews[0] === view,
    `Expected only ${view} pressed; received ${JSON.stringify(viewStates)}`,
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

async function clickExposedBackground(locator, label) {
  const position = await locator.evaluate((background) => {
    const bounds = background.getBoundingClientRect();
    const siblingControls = Array.from(
      background.parentElement?.querySelectorAll("button, a") ?? [],
    )
      .filter((control) => control !== background)
      .map((control) => control.getBoundingClientRect());
    const inset = 8;

    for (let y = bounds.bottom - inset; y >= bounds.top + inset; y -= inset) {
      for (let x = bounds.left + inset; x <= bounds.right - inset; x += inset) {
        const isCovered = siblingControls.some(
          (control) =>
            x >= control.left &&
            x <= control.right &&
            y >= control.top &&
            y <= control.bottom,
        );

        if (!isCovered) {
          return { x: x - bounds.left, y: y - bounds.top };
        }
      }
    }

    return null;
  });

  assert(position, `${label} has no exposed click point outside its event controls`);
  await locator.click({ position });
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
  const step = createStepRunner("desktop", page);
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

    await step("Week/List navigation and Project week reset", async () => {
      for (const view of ["List", "Week"]) {
        await selectView(page, view);
        const next = await assertUnique(
          page.getByRole("button", { name: "Next week", exact: true }),
          `${view} Next week button`,
        );
        await next.click();
        await assertPeriod(page, nextWeekLabel);

        const reset = await assertUnique(
          page.getByRole("button", { name: "Project week", exact: true }),
          `${view} Project week button`,
        );
        assert(
          await reset.isEnabled(),
          `${view} Project week should be enabled after navigation`,
        );
        await reset.click();
        await assertPeriod(page, projectWeekLabel);
      }

      await selectView(page, "List");
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
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "13:00",
        "Day creation should default Start to 13:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).inputValue()) === "14:00",
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
      await clickExposedBackground(background, "Populated Month background");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-15",
        "Month creation should keep Jan 15",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "09:00",
        "Month creation should default Start to 09:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).inputValue()) === "10:00",
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
  const step = createStepRunner("mobile", page);
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
      assert(
        (await calendarTab.getAttribute("aria-current")) === "page",
        "Mobile Calendar tab does not expose aria-current=page",
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

async function assertPreviewAvailable() {
  const target = calendarUrl();

  try {
    const response = await fetch(target, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    await response.body?.cancel();
  } catch (error) {
    throw new Error(
      [
        `Calendar preview is unavailable at ${target}.`,
        "Start a production preview with `npm run build` then `npm run preview`,",
        "or set PREVIEW_BASE_URL to an already-running preview.",
        `Connection detail: ${errorMessage(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch(
      browserExecutable ? { executablePath: browserExecutable } : {},
    );
  } catch (error) {
    throw new Error(
      [
        "Unable to launch a Chromium browser for Calendar regression.",
        browserExecutable
          ? `Configured browser: ${browserExecutable}`
          : "Install Playwright Chromium or set PREVIEW_BROWSER_EXECUTABLE to Chrome/Edge.",
        `Launch detail: ${errorMessage(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function main() {
  console.log(`Calendar regression target: ${calendarUrl()}`);
  await assertPreviewAvailable();

  const browser = await launchBrowser();

  try {
    await runDesktop(browser);
    await runMobile(browser);
  } finally {
    await browser.close();
  }

  console.log("Calendar interaction regression passed.");
}

main().catch((error) => {
  console.error(`\nCalendar interaction regression failed.\n${errorMessage(error)}`);
  process.exitCode = 1;
});
