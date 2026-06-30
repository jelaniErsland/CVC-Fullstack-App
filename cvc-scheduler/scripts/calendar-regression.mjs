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
const previousWeekLabel = "Jan 5 to Jan 11, 2026";
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

async function activateWithKeyboard(locator, label, key = "Enter") {
  await locator.focus();
  assert(
    await locator.evaluate((element) => element === document.activeElement),
    `${label} did not receive keyboard focus`,
  );
  await locator.press(key);
}

async function selectView(page, view) {
  const button = await assertUnique(
    page.getByRole("button", { name: view, exact: true }),
    `${view} view button`,
  );

  await activateWithKeyboard(button, `${view} view button`);
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

async function pressAndWaitForFocus(page, key, label) {
  await page.keyboard.press(key);
  await waitForFocusLabel(page, label);
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

async function assertClosedSurfaceInert(page, closeLabel) {
  const state = await page.evaluate((label) => {
    const closeControl = Array.from(
      document.querySelectorAll(`[aria-label="${label}"]`),
    ).find((control) => control.closest('[aria-hidden="true"]'));
    const root = closeControl?.closest('[aria-hidden="true"]');

    return {
      activeInside: Boolean(root?.contains(document.activeElement)),
      inert: Boolean(root?.hasAttribute("inert")),
    };
  }, closeLabel);

  assert(state.inert, `${closeLabel} closed surface is not inert`);
  assert(!state.activeInside, `${closeLabel} retained focus while closed`);
}

const dialogFocusableSelector = [
  "a[href]",
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

async function assertDialogFocusContainment(page, dialog, label) {
  assert(
    (await dialog.getAttribute("aria-modal")) === "true",
    `${label} should expose aria-modal=true`,
  );

  const descriptionId = await dialog.getAttribute("aria-describedby");
  assert(descriptionId, `${label} should reference an accessible description`);
  const description = dialog.locator(`[id="${descriptionId}"]`);
  assert(
    (await description.count()) === 1 && (await description.textContent())?.trim(),
    `${label} accessible description is missing or empty`,
  );

  const focusable = dialog.locator(dialogFocusableSelector);
  const focusableCount = await focusable.count();
  assert(focusableCount > 0, `${label} has no focusable controls`);
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();

  assert(
    await firstFocusable.evaluate((element) => element === document.activeElement),
    `${label} initial focus is not on its first control`,
  );

  await page.keyboard.press("Shift+Tab");
  assert(
    await lastFocusable.evaluate((element) => element === document.activeElement),
    `${label} Shift+Tab did not wrap to its last control`,
  );
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    `${label} allowed focus to leave after Shift+Tab`,
  );

  await page.keyboard.press("Tab");
  assert(
    await firstFocusable.evaluate((element) => element === document.activeElement),
    `${label} Tab did not wrap to its first control`,
  );
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    `${label} allowed focus to leave after Tab`,
  );

  return (await description.textContent())?.trim() ?? "";
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
        const previous = await assertUnique(
          page.getByRole("button", { name: "Previous week", exact: true }),
          `${view} Previous week button`,
        );
        const next = await assertUnique(
          page.getByRole("button", { name: "Next week", exact: true }),
          `${view} Next week button`,
        );

        await activateWithKeyboard(previous, `${view} Previous week button`);
        await assertPeriod(page, previousWeekLabel);
        await activateWithKeyboard(next, `${view} Next week button`);
        await assertPeriod(page, projectWeekLabel);
        await activateWithKeyboard(next, `${view} Next week button`);
        await assertPeriod(page, nextWeekLabel);

        const reset = await assertUnique(
          page.getByRole("button", { name: "Project week", exact: true }),
          `${view} Project week button`,
        );
        assert(
          await reset.isEnabled(),
          `${view} Project week should be enabled after navigation`,
        );
        await activateWithKeyboard(reset, `${view} Project week button`);
        await assertPeriod(page, projectWeekLabel);
      }

      await selectView(page, "List");
    });

    await step("desktop filters focus, filter to Food, and close", async () => {
      const trigger = await assertUnique(
        page.getByRole("button", { name: "Open calendar filters", exact: true }),
        "Calendar filters trigger",
      );
      await activateWithKeyboard(trigger, "Calendar filters trigger");
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      const filterDescription = await assertDialogFocusContainment(
        page,
        dialog,
        "Desktop filters",
      );
      assert(
        filterDescription.includes("task name, coverage, or task type"),
        "Desktop filters description lacks filter context",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Filters should be the only active Calendar surface",
      );

      const foodFilter = await assertUnique(
        dialog.getByRole("button", { name: "Food", exact: true }),
        "Food filter toggle",
      );
      assert(
        (await foodFilter.getAttribute("aria-pressed")) === "false",
        "Food filter should initially expose aria-pressed=false",
      );
      await activateWithKeyboard(foodFilter, "Food filter toggle");
      assert(
        (await foodFilter.getAttribute("aria-pressed")) === "true",
        "Food filter should expose aria-pressed=true after activation",
      );
      const showResults = await assertUnique(
        dialog.getByRole("button", { name: "Show results (1)", exact: true }),
        "Show filtered results button",
      );
      await activateWithKeyboard(showResults, "Show filtered results button");
      await dialog.waitFor({ state: "hidden" });
      await waitForFocusLabel(page, "Open calendar filters");
      await assertClosedSurfaceInert(page, "Close calendar filters");
      await page.getByText("4 visible items - Food", { exact: true }).waitFor();
      assert(
        (await page
          .locator('[data-testid="calendar-list-view"] [role="listitem"] > button')
          .count()) === 4,
        "Food filter should leave four List rows",
      );
      await activateWithKeyboard(
        await assertUnique(
          page.getByRole("button", { name: "Reset", exact: true }),
          "Reset filters button",
        ),
        "Reset filters button",
      );
    });

    await step("desktop item inspector focus and Escape restoration", async () => {
      await selectView(page, "Week");
      const trigger = await assertUnique(
        page.getByRole("button", { name: weekItemLabel, exact: true }),
        "Week event button",
      );
      await activateWithKeyboard(trigger, "Week event button");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      const inspectorDescription = await assertDialogFocusContainment(
        page,
        inspector,
        "Desktop inspector",
      );
      assert(
        inspectorDescription.includes("Gate attendant") &&
          inspectorDescription.includes("1 of 1 volunteers") &&
          inspectorDescription.includes("Tue Jan 13"),
        "Inspector description lacks task, coverage, or date context",
      );
      await closeWithEscape(page, "Calendar item inspector", weekItemLabel);
    });

    await step("desktop Day arrows, creation, and focus restoration", async () => {
      await selectView(page, "Day");
      const triggerLabel = "Plan project work on Tue Jan 13 at 1 PM";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Day creation target",
      );
      const dayTargetAudit = await page.evaluate(() => {
        const targets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="day-hour"]'),
        );

        return {
          count: targets.length,
          tabbable: targets.every((target) => target instanceof HTMLElement && target.tabIndex >= 0),
        };
      });
      assert(
        dayTargetAudit.count === 24 && dayTargetAudit.tabbable,
        "Day should keep 24 normally tabbable hour targets",
      );

      await trigger.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowDown",
        "Plan project work on Tue Jan 13 at 2 PM",
      );
      await pressAndWaitForFocus(page, "ArrowUp", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work on Tue Jan 13 at 12 AM",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work on Tue Jan 13 at 11 PM",
      );

      await activateWithKeyboard(trigger, "Day creation target");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      const creationDescription = await assertDialogFocusContainment(
        page,
        planner,
        "Desktop creation",
      );
      assert(
        creationDescription.includes("Saving, scheduling, and helper assignment"),
        "Creation description lacks preview availability context",
      );
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

      const taskPresetMode = await assertUnique(
        planner.getByRole("button", { name: "Task preset", exact: true }),
        "Task preset mode",
      );
      const customMode = await assertUnique(
        planner.getByRole("button", { name: "Custom one-day", exact: true }),
        "Custom one-day mode",
      );
      assert(
        (await taskPresetMode.getAttribute("aria-pressed")) === "true" &&
          (await customMode.getAttribute("aria-pressed")) === "false",
        "Creation task-source buttons should expose their selected state",
      );

      const endInput = planner.getByLabel("End", { exact: true });
      await endInput.fill("12:00");
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('input[type="time"]')).some(
            (input) =>
              input.value === "12:00" &&
              input.getAttribute("aria-invalid") === "true",
          ),
      );
      const errorDescriptionId = await endInput.getAttribute("aria-describedby");
      assert(errorDescriptionId, "Invalid End should reference an error description");
      await planner.locator(`[id="${errorDescriptionId}"]`).waitFor();
      await endInput.fill("14:00");

      for (const action of ["Schedule", "Save draft", "Assign helpers"]) {
        const actionButton = await assertUnique(
          planner.getByRole("button", { name: action, exact: true }),
          `${action} preview action`,
        );
        assert(!(await actionButton.isEnabled()), `${action} should remain disabled`);
        assert(
          Boolean(await actionButton.getAttribute("aria-describedby")),
          `${action} should describe why it is unavailable`,
        );
      }
      await closeWithEscape(page, "Plan project work", triggerLabel);

      await trigger.focus();
      const arrowSpaceTriggerLabel = "Plan project work on Tue Jan 13 at 2 PM";
      await pressAndWaitForFocus(page, "ArrowDown", arrowSpaceTriggerLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(
        page,
        planner,
        "Arrow-focused Day creation",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "14:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) === "15:00",
        "Day Space creation should preserve the arrow-focused 2 PM default",
      );
      await closeWithEscape(page, "Plan project work", arrowSpaceTriggerLabel);
    });

    await step("desktop Month arrows, sibling controls, and creation", async () => {
      await selectView(page, "Month");
      const event = await assertUnique(
        page.getByRole("button", { name: monthItemLabel, exact: true }),
        "Month event chip",
      );
      await activateWithKeyboard(event, "Month event chip");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await closeWithEscape(page, "Calendar item inspector", monthItemLabel);

      const triggerLabel = "Plan project work on Thu Jan 15";
      const background = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Populated Month background",
      );
      const monthTargetAudit = await page.evaluate(() => {
        const targets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="month-date"]'),
        );

        return {
          count: targets.length,
          tabbable: targets.every((target) => target instanceof HTMLElement && target.tabIndex >= 0),
        };
      });
      assert(
        monthTargetAudit.count === 35 && monthTargetAudit.tabbable,
        "January Month should keep 35 normally tabbable visible date targets",
      );
      await background.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work on Fri Jan 16",
      );
      await pressAndWaitForFocus(page, "ArrowLeft", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "ArrowDown",
        "Plan project work on Thu Jan 22",
      );
      await pressAndWaitForFocus(page, "ArrowUp", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work on Sun Dec 28",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work on Sat Jan 31",
      );

      const siblingState = await background.evaluate((backgroundControl, eventLabel) => {
        const cell = backgroundControl.parentElement;
        const eventControl = Array.from(cell?.querySelectorAll("button") ?? []).find(
          (control) => control.getAttribute("aria-label") === eventLabel,
        );

        return {
          eventFound: Boolean(eventControl),
          nested:
            Boolean(eventControl) &&
            (backgroundControl.contains(eventControl) ||
              eventControl.contains(backgroundControl)),
        };
      }, monthItemLabel);
      assert(siblingState.eventFound, "Month event chip was not found in its date cell");
      assert(!siblingState.nested, "Month background and event chip must be sibling controls");
      const nestedMonthControls = await page
        .locator(
          '[data-calendar-arrow-group="month-dates"] button button, [data-calendar-arrow-group="month-dates"] button a, [data-calendar-arrow-group="month-dates"] a button',
        )
        .count();
      assert(
        nestedMonthControls === 0,
        `Month contains ${nestedMonthControls} nested interactive controls`,
      );
      await activateWithKeyboard(background, "Populated Month background");
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

      await background.focus();
      const arrowSpaceTriggerLabel = "Plan project work on Fri Jan 16";
      await pressAndWaitForFocus(page, "ArrowRight", arrowSpaceTriggerLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(
        page,
        planner,
        "Arrow-focused Month creation",
      );
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-16" &&
          (await planner.getByLabel("Start", { exact: true }).inputValue()) ===
            "09:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) ===
            "10:00",
        "Month Space creation should preserve the arrow-focused Jan 16 default",
      );
      await closeWithEscape(page, "Plan project work", arrowSpaceTriggerLabel);
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
      await activateWithKeyboard(trigger, "List row", "Space");
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
      await calendarTab.focus();
      assert(
        await calendarTab.evaluate((element) => element === document.activeElement),
        "Mobile Calendar tab is not keyboard reachable",
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

      await selectView(page, "Month");
      const mobileMonthDate = await assertUnique(
        page.getByRole("button", {
          name: "Plan project work on Wed Jan 14",
          exact: true,
        }),
        "Mobile Month date target",
      );
      await mobileMonthDate.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work on Thu Jan 15",
      );
      const overflow = await assertUnique(
        page.getByRole("button", {
          name: "Switch to Day view for Wed Jan 14 to show 3 more calendar items",
          exact: true,
        }),
        "Mobile Month overflow button",
      );
      const overflowSiblingState = await overflow.evaluate((overflowControl) => {
        const cell = overflowControl.closest("[data-calendar-month-cell]");
        const background = cell?.querySelector("[data-calendar-arrow-target]");

        return {
          backgroundFound: Boolean(background),
          nested:
            Boolean(background) &&
            (background.contains(overflowControl) ||
              overflowControl.contains(background)),
        };
      });
      assert(
        overflowSiblingState.backgroundFound && !overflowSiblingState.nested,
        "Mobile Month overflow and date creation target must remain sibling controls",
      );
      await activateWithKeyboard(overflow, "Mobile Month overflow button");
      assert(
        (await page
          .getByRole("button", { name: "Day", exact: true })
          .getAttribute("aria-pressed")) === "true",
        "Mobile Month overflow should switch to Day view",
      );
      await selectView(page, "Week");
      await assertNoHorizontalOverflow(page, "Mobile view controls");
    });

    await step("mobile More keyboard focus, Escape, and exclusivity", async () => {
      const trigger = await assertUnique(
        page.getByRole("button", {
          name: "Open more admin navigation",
          exact: true,
        }),
        "Mobile More trigger",
      );
      assert(
        (await trigger.getAttribute("aria-expanded")) === "false",
        "Mobile More should initially expose aria-expanded=false",
      );
      await activateWithKeyboard(trigger, "Mobile More trigger");
      const more = page.getByRole("dialog", {
        name: "More admin navigation",
        exact: true,
      });
      await more.waitFor();
      await waitForFocusLabel(page, "Close more admin navigation");
      const moreDescription = await assertDialogFocusContainment(
        page,
        more,
        "Mobile More",
      );
      assert(
        moreDescription.includes("Additional admin destinations"),
        "Mobile More description lacks destination context",
      );
      assert(
        (await trigger.getAttribute("aria-expanded")) === "true",
        "Mobile More should expose aria-expanded=true while open",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile More should be the only active surface",
      );
      await page.keyboard.press("Escape");
      await more.waitFor({ state: "hidden" });
      await waitForFocusLabel(page, "Open more admin navigation");
      assert(
        (await trigger.getAttribute("aria-expanded")) === "false",
        "Mobile More should expose aria-expanded=false after Escape",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 0,
        "Mobile More Escape should leave a clean Calendar surface",
      );
    });

    await step("mobile filters open as the only sheet", async () => {
      const trigger = page.getByRole("button", {
        name: "Open calendar filters",
        exact: true,
      });
      await activateWithKeyboard(trigger, "Mobile filters trigger");
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      await assertDialogFocusContainment(page, dialog, "Mobile filters");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile filters should not stack with More or another dialog",
      );
      await closeWithEscape(page, "Calendar filters", "Open calendar filters");
      await assertClosedSurfaceInert(page, "Close calendar filters");
    });

    await step("mobile item opens the inspector sheet alone", async () => {
      const trigger = page.getByRole("button", { name: weekItemLabel, exact: true });
      await activateWithKeyboard(trigger, "Mobile Week event button");
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
      await activateWithKeyboard(trigger, "Mobile Week creation target");
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
