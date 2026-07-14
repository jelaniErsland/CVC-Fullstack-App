import "server-only";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE as PREFLIGHT_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE as PREFLIGHT_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE as PREFLIGHT_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE as PREFLIGHT_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  CALENDAR_REMINDER_DELIVERY_AVAILABLE as PREFLIGHT_CALENDAR_REMINDER_DELIVERY_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED as PREFLIGHT_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER as PREFLIGHT_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED as PREFLIGHT_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED as PREFLIGHT_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE as PREFLIGHT_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_ROUTE_USES_DRY_RUN_HARNESS as PREFLIGHT_CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
  CALENDAR_SEED_DATA_AVAILABLE as PREFLIGHT_CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE as PREFLIGHT_CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  describeCalendarRouteCutoverFinalPreflight,
} from "./routeCutoverFinalPreflight.server.ts";
import { describeCalendarPersistedReadModelContract } from "./readModelContract.server.ts";

export const CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_AVAILABLE = true;
export const CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_ROUTE_UNUSED = true;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED =
  PREFLIGHT_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED;
export const CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER =
  PREFLIGHT_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER;
export const CALENDAR_ROUTE_USES_DRY_RUN_HARNESS =
  PREFLIGHT_CALENDAR_ROUTE_USES_DRY_RUN_HARNESS;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED =
  PREFLIGHT_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE =
  PREFLIGHT_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE =
  PREFLIGHT_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE =
  PREFLIGHT_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED =
  PREFLIGHT_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED;
export const CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE =
  PREFLIGHT_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE;
export const CALENDAR_REMINDER_DELIVERY_AVAILABLE =
  PREFLIGHT_CALENDAR_REMINDER_DELIVERY_AVAILABLE;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  PREFLIGHT_CALENDAR_SERVICE_ROLE_READ_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = PREFLIGHT_CALENDAR_SEED_DATA_AVAILABLE;
export const CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE =
  PREFLIGHT_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE;

export const CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_NEXT_RECOMMENDED_SLICE =
  "12.11 Calendar Persisted Read Route Cutover Implementation" as const;

export type CalendarRouteCutoverPrototypeView = "day" | "week" | "month" | "list";
export type CalendarRouteCutoverPrototypeStateKind =
  | "ready_with_items"
  | "ready_empty"
  | "unavailable"
  | "error";
export type CalendarRouteCutoverUnavailableReason =
  | "unauthenticated"
  | "unauthorized"
  | "missing_calendar_view"
  | "missing_assignments_view"
  | "workspace_unavailable"
  | "invalid_period_or_range"
  | "prerequisite_unavailable";
export type CalendarRouteCutoverErrorReason =
  | "query_unavailable"
  | "unexpected_read_failure"
  | "safe_error";

export type CalendarRouteCutoverPrototypeState =
  | Readonly<{
      kind: "ready_with_items";
      view: CalendarRouteCutoverPrototypeView;
      itemCount: number;
    }>
  | Readonly<{
      kind: "ready_empty";
      view: CalendarRouteCutoverPrototypeView;
      itemCount: 0;
    }>
  | Readonly<{
      kind: "unavailable";
      view: CalendarRouteCutoverPrototypeView;
      reason: CalendarRouteCutoverUnavailableReason;
    }>
  | Readonly<{
      kind: "error";
      view: CalendarRouteCutoverPrototypeView;
      reason: CalendarRouteCutoverErrorReason;
    }>;

export type CalendarRouteCutoverPrototypePresentation = Readonly<{
  stateKind: CalendarRouteCutoverPrototypeStateKind;
  view: CalendarRouteCutoverPrototypeView;
  preserveCalendarShell: true;
  preserveViewControls: true;
  preserveDateNavigation: true;
  preserveFilterControls: true;
  preserveCreationPreviewOnlyBehavior: true;
  renderNormalCalendarItems: boolean;
  renderEmptyState: boolean;
  renderUnavailableState: boolean;
  renderErrorState: boolean;
  userFacingHeading: string;
  userFacingCopy: string;
  userFacingTone: "normal" | "empty" | "unavailable" | "error";
  mockFallbackAllowed: false;
  mockPersistedMixAllowed: false;
  rawInternalDetailsAllowed: false;
  safeForUserFacingOutput: true;
}>;

export const calendarRouteCutoverStatePrototypeStates = [
  "ready_with_items",
  "ready_empty",
  "unavailable",
  "error",
] as const;

export const calendarRouteCutoverStatePrototypeViews = [
  "day",
  "week",
  "month",
  "list",
] as const;

export const calendarRouteCutoverStatePrototypeCopy = {
  readyWithItems: {
    heading: "Calendar",
    copy:
      "Show the selected Calendar view with projected scheduled items using the existing Day, Week, Month, and List interaction model.",
  },
  readyEmpty: {
    heading: "No scheduled items in this range",
    copy:
      "This project has no scheduled Calendar items for the selected range. Choose another date or view to keep planning.",
  },
  unavailable: {
    heading: "Calendar is unavailable right now",
    copy:
      "We cannot show the persisted Calendar view from this context yet. Nothing has been changed; try again later or ask a project contact to review access.",
  },
  error: {
    heading: "Calendar could not load",
    copy:
      "Something went wrong while preparing the Calendar view. Nothing has been changed; try again in a moment.",
  },
} as const;

export const calendarRouteCutoverStatePrototypeUnsafeUserFacingFields = [
  "auth_session_detail",
  "grant_detail",
  "workspace_internal_detail",
  "raw_capability_arrays",
  "supabase_error",
  "sql_detail",
  "rpc_detail",
  "policy_name",
  "table_name",
  "stack_trace",
  "raw_exception_message",
  "token",
  "bearer",
  "verifier",
  "audit_id",
  "access_token",
  "refresh_token",
  "service_role_key",
  "response_url",
  "volunteer_contact_values",
  "questionnaire_answers",
  "emergency_contact_values",
  "unrelated_row_data",
] as const;

export const calendarRouteCutoverStatePrototypeStateRules = {
  readyWithItems: {
    stateKind: "ready_with_items",
    requiresSuccessfulAuthorizedRead: true,
    requiresItemCountGreaterThanZero: true,
    renderExistingCalendarSurface: true,
    renderNormalCalendarItems: true,
    emptyState: false,
    unavailableState: false,
    errorState: false,
  },
  readyEmpty: {
    stateKind: "ready_empty",
    requiresSuccessfulAuthorizedRead: true,
    requiresItemCountZero: true,
    emptyIsFailure: false,
    emptyIsUnavailable: false,
    emptyIsError: false,
    renderExistingCalendarShell: true,
    renderCalmIntentionalEmptyState: true,
    createFakeCalendarItemsToFillView: false,
  },
  unavailable: {
    stateKind: "unavailable",
    intentionalPrerequisiteFailure: true,
    distinctFromUnexpectedError: true,
    failClosed: true,
    exposeInternalReasonToUser: false,
    silentMockFallbackAllowed: false,
  },
  error: {
    stateKind: "error",
    unexpectedFailureAfterPrerequisites: true,
    distinctFromUnavailable: true,
    failClosed: true,
    rawErrorRenderingAllowed: false,
    silentMockFallbackAllowed: false,
  },
} as const;

export const calendarRouteCutoverStatePrototypeUiContract = {
  preserveExistingCalendarShell: true,
  preserveDayWeekMonthListViews: true,
  preserveDateNavigation: true,
  preserveViewControls: true,
  preserveFilters: true,
  preserveInspectorInteractionModelWhereSafe: true,
  preservePreviewOnlyCreationBehavior: true,
  redesignCalendarSurfaceInThisSlice: false,
  overviewDashboardLayerAllowed: false,
  eventBlocksRemainMinimal: true,
  emptyUnavailableErrorFitInsideExistingPage: true,
  productionRouteDataBehaviorChanged: false,
} as const;

function assertPrototypeItemCount(state: CalendarRouteCutoverPrototypeState) {
  if (state.kind === "ready_with_items" && state.itemCount <= 0) {
    return "ready_with_items_requires_positive_item_count" as const;
  }

  return null;
}

export function getCalendarRouteCutoverStatePrototypePresentation(
  state: CalendarRouteCutoverPrototypeState,
): CalendarRouteCutoverPrototypePresentation {
  const itemCountError = assertPrototypeItemCount(state);

  if (itemCountError) {
    return {
      stateKind: "error",
      view: state.view,
      preserveCalendarShell: true,
      preserveViewControls: true,
      preserveDateNavigation: true,
      preserveFilterControls: true,
      preserveCreationPreviewOnlyBehavior: true,
      renderNormalCalendarItems: false,
      renderEmptyState: false,
      renderUnavailableState: false,
      renderErrorState: true,
      userFacingHeading: calendarRouteCutoverStatePrototypeCopy.error.heading,
      userFacingCopy: calendarRouteCutoverStatePrototypeCopy.error.copy,
      userFacingTone: "error",
      mockFallbackAllowed: false,
      mockPersistedMixAllowed: false,
      rawInternalDetailsAllowed: false,
      safeForUserFacingOutput: true,
    };
  }

  if (state.kind === "ready_with_items") {
    return {
      stateKind: "ready_with_items",
      view: state.view,
      preserveCalendarShell: true,
      preserveViewControls: true,
      preserveDateNavigation: true,
      preserveFilterControls: true,
      preserveCreationPreviewOnlyBehavior: true,
      renderNormalCalendarItems: true,
      renderEmptyState: false,
      renderUnavailableState: false,
      renderErrorState: false,
      userFacingHeading: calendarRouteCutoverStatePrototypeCopy.readyWithItems.heading,
      userFacingCopy: calendarRouteCutoverStatePrototypeCopy.readyWithItems.copy,
      userFacingTone: "normal",
      mockFallbackAllowed: false,
      mockPersistedMixAllowed: false,
      rawInternalDetailsAllowed: false,
      safeForUserFacingOutput: true,
    };
  }

  if (state.kind === "ready_empty") {
    return {
      stateKind: "ready_empty",
      view: state.view,
      preserveCalendarShell: true,
      preserveViewControls: true,
      preserveDateNavigation: true,
      preserveFilterControls: true,
      preserveCreationPreviewOnlyBehavior: true,
      renderNormalCalendarItems: false,
      renderEmptyState: true,
      renderUnavailableState: false,
      renderErrorState: false,
      userFacingHeading: calendarRouteCutoverStatePrototypeCopy.readyEmpty.heading,
      userFacingCopy: calendarRouteCutoverStatePrototypeCopy.readyEmpty.copy,
      userFacingTone: "empty",
      mockFallbackAllowed: false,
      mockPersistedMixAllowed: false,
      rawInternalDetailsAllowed: false,
      safeForUserFacingOutput: true,
    };
  }

  if (state.kind === "unavailable") {
    return {
      stateKind: "unavailable",
      view: state.view,
      preserveCalendarShell: true,
      preserveViewControls: true,
      preserveDateNavigation: true,
      preserveFilterControls: true,
      preserveCreationPreviewOnlyBehavior: true,
      renderNormalCalendarItems: false,
      renderEmptyState: false,
      renderUnavailableState: true,
      renderErrorState: false,
      userFacingHeading: calendarRouteCutoverStatePrototypeCopy.unavailable.heading,
      userFacingCopy: calendarRouteCutoverStatePrototypeCopy.unavailable.copy,
      userFacingTone: "unavailable",
      mockFallbackAllowed: false,
      mockPersistedMixAllowed: false,
      rawInternalDetailsAllowed: false,
      safeForUserFacingOutput: true,
    };
  }

  return {
    stateKind: "error",
    view: state.view,
    preserveCalendarShell: true,
    preserveViewControls: true,
    preserveDateNavigation: true,
    preserveFilterControls: true,
    preserveCreationPreviewOnlyBehavior: true,
    renderNormalCalendarItems: false,
    renderEmptyState: false,
    renderUnavailableState: false,
    renderErrorState: true,
    userFacingHeading: calendarRouteCutoverStatePrototypeCopy.error.heading,
    userFacingCopy: calendarRouteCutoverStatePrototypeCopy.error.copy,
    userFacingTone: "error",
    mockFallbackAllowed: false,
    mockPersistedMixAllowed: false,
    rawInternalDetailsAllowed: false,
    safeForUserFacingOutput: true,
  };
}

export function describeCalendarRouteCutoverStatePrototype() {
  return {
    prototypeAvailable: CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_AVAILABLE,
    routeUnused: CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_ROUTE_UNUSED,
    routePersistedReadCutoverImplemented: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
    routeImportsReadModelQueryHelper: CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
    routeUsesDryRunHarness: CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    publicLookupCutoverAvailable: CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
    reminderDeliveryAvailable: CALENDAR_REMINDER_DELIVERY_AVAILABLE,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    hostedCutoverValidationAvailable: CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
    states: calendarRouteCutoverStatePrototypeStates,
    views: calendarRouteCutoverStatePrototypeViews,
    copy: calendarRouteCutoverStatePrototypeCopy,
    unsafeUserFacingFields: calendarRouteCutoverStatePrototypeUnsafeUserFacingFields,
    stateRules: calendarRouteCutoverStatePrototypeStateRules,
    uiContract: calendarRouteCutoverStatePrototypeUiContract,
    persistedReadModelContract: describeCalendarPersistedReadModelContract(),
    finalPreflight: describeCalendarRouteCutoverFinalPreflight(),
    nextRecommendedSlice:
      CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_NEXT_RECOMMENDED_SLICE,
  } as const;
}
