import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
} from "../lib/assignments/detailResponseLinkEnablementChecklist.server.ts";
import { ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE } from "../lib/assignments/detailRouteEntryPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
} from "../lib/responseTokens/productActionDisabledAdapter.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE,
} from "../lib/responseTokens/productActionServerActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_FORBIDDEN_BROWSER_FIELDS,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED,
  createDisabledAssignmentResponseLinkServerAction,
  createDisabledAssignmentResponseLinkServerActionWithDependencies,
  describeDisabledAssignmentResponseLinkServerAction,
} from "../lib/responseTokens/productActionServerAction.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE } from "../lib/responseTokens/productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE } from "../lib/responseTokens/productActionWiringPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE,
} from "../lib/responseTokens/productActionPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "../lib/responseTokens/productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "../lib/responseTokens/revealPolicy.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assignmentId = "11111111-1111-4111-8111-111111111111";
const serverActionPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionServerAction.server.ts",
);
const routePath = path.join(
  root,
  "app",
  "admin",
  "assignments",
  "[assignmentId]",
  "page.tsx",
);
const serverActionSource = await readFile(serverActionPath, "utf8");
const routeSource = await readFile(routePath, "utf8");
const packageSource = await readFile(path.join(root, "package.json"), "utf8");

const forbiddenResultFragments = [
  "responseUrl",
  "fullResponseUrl",
  "redactedResponseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "sqlDetail",
  "internalRpcDetail",
  "sensitiveIntakeValue",
  "sensitiveIntakeData",
  "unrelatedRowMarker",
  "unrelatedRowData",
];

function createFormData(entries = []) {
  const formData = new FormData();
  for (const [key, value] of entries) {
    formData.append(key, value);
  }
  return formData;
}

function assertCredentialFreeDisabledResult(result) {
  assert.equal(result.status, "disabled");
  const serialized = JSON.stringify(result);
  for (const fragment of forbiddenResultFragments) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `server-action result must not include ${fragment}`,
    );
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

assert.match(serverActionSource, /^import "server-only";/);
assert.match(serverActionSource, /"use server";/);
assert.match(serverActionSource, /createAssignmentDetailResponseLinkDisabledAdapterWithDependencies/);
assert.match(serverActionSource, /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE = true/);
assert.match(serverActionSource, /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED = false/);
assert.match(
  serverActionSource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(serverActionSource, /"\/admin\/assignments\/\[assignmentId\]"/);
assert.match(serverActionSource, /"expiresInHours"/);
for (const forbiddenField of [
  "assignmentId",
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
]) {
  assert.match(serverActionSource, new RegExp(forbiddenField));
}
assert.doesNotMatch(
  serverActionSource,
  /from "\.\/productAction\.server|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|replaceAssignmentResponseToken|replace_assignment_response_token|issueAssignmentResponseLink|recordAssignmentResponseLinkRevealAudit|assignment_response_tokens|\.rpc\(|(?<!Array)\.from\(|redirect\(|permanentRedirect\(|revalidatePath\(|revalidateTag\(|cookies\(|headers\(|NextResponse|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText|sendEmail|sendReminder|enqueue/i,
);
assert.match(
  routeSource,
  /import \{ createDisabledAssignmentResponseLinkServerAction \} from "@\/lib\/responseTokens\/productActionServerAction\.server"/,
);
assert.match(
  routeSource,
  /getDisabledResponseLinkWiringState\(\s*disabledResponseLinkAction,\s*\)/s,
);
assert.doesNotMatch(
  routeSource,
  /createDisabledAssignmentResponseLinkServerAction\([^)]|<form\b|formAction|type=["']submit["']|type=["']hidden["']|onClick=|useActionState|useFormState|resultRenderer|resultComponent|actionResult|disabledResult|not_approved|checklist_blocked|retry_affordance|download_affordance|open_link_affordance|navigator\.clipboard|clipboard\.writeText/i,
);
assert.match(
  routeSource,
  /const disabledResponseLinkAction =\s*createDisabledAssignmentResponseLinkServerAction\.bind\(null, normalizedAssignmentId\);/s,
);
assert.match(
  packageSource,
  /"test:assignment-detail-server-action": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/assignment-detail-server-action-regression\.mjs"/,
);

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const serverActionImporters = [];
const assignmentDetailInboundLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("productActionServerAction") ||
    source.includes("createDisabledAssignmentResponseLinkServerAction")
  ) {
    serverActionImporters.push(relative);
  }
  if (
    relative !== "app/admin/assignments/[assignmentId]/page.tsx" &&
    source.includes("/admin/assignments/")
  ) {
    assignmentDetailInboundLinks.push(relative);
  }
}
assert.deepEqual(serverActionImporters, ["app/admin/assignments/[assignmentId]/page.tsx"]);
assert.deepEqual(assignmentDetailInboundLinks, []);

const description = describeDisabledAssignmentResponseLinkServerAction();
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE, "disabled");
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE,
  false,
);
assert.equal(description.stubAvailable, true);
assert.equal(description.routeUnused, false);
assert.equal(description.defaultState, "disabled");
assert.equal(description.finalApprovalAvailable, false);
assert.equal(description.eligibleRoute, "/admin/assignments/[assignmentId]");
assert.deepEqual(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS, [
  "expiresInHours",
]);
assert.deepEqual(description.allowedFormFields, ["expiresInHours"]);

for (const forbiddenField of [
  "assignmentId",
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
]) {
  assert.ok(
    RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_FORBIDDEN_BROWSER_FIELDS.includes(
      forbiddenField,
    ),
  );
  assert.ok(description.forbiddenBrowserFields.includes(forbiddenField));
}

let adapterCallCount = 0;
let lastAdapterInput = null;
async function adapterSpy(input) {
  adapterCallCount += 1;
  lastAdapterInput = input;
  return { status: "disabled", reason: "not_approved" };
}

async function exercise(formData, adapter = adapterSpy, id = assignmentId) {
  return createDisabledAssignmentResponseLinkServerActionWithDependencies(id, formData, {
    adapter,
  });
}

let result = await exercise(undefined);
assert.deepEqual(result, { status: "disabled", reason: "not_approved" });
assertCredentialFreeDisabledResult(result);
assert.equal(adapterCallCount, 1);
assert.deepEqual(lastAdapterInput, { assignmentId });

for (const expiresInHours of ["1", "72", "168"]) {
  result = await exercise(createFormData([["expiresInHours", expiresInHours]]));
  assert.deepEqual(result, { status: "disabled", reason: "not_approved" });
  assertCredentialFreeDisabledResult(result);
  assert.deepEqual(lastAdapterInput, {
    assignmentId,
    expiresInHours: Number(expiresInHours),
  });
}
assert.equal(adapterCallCount, 4);

result = await createDisabledAssignmentResponseLinkServerAction(assignmentId);
assert.deepEqual(result, { status: "disabled", reason: "not_approved" });
assertCredentialFreeDisabledResult(result);

for (const malformedAssignmentId of [
  "",
  "not-a-uuid",
  "11111111-1111-1111-1111-111111111111",
  "11111111-1111-4111-7111-111111111111",
]) {
  const before = adapterCallCount;
  result = await exercise(undefined, adapterSpy, malformedAssignmentId);
  assert.deepEqual(result, { status: "disabled", reason: "malformed" });
  assertCredentialFreeDisabledResult(result);
  assert.equal(adapterCallCount, before);
}

for (const expiresInHours of ["0", "169", "1.5", "", "not-a-number"]) {
  const before = adapterCallCount;
  result = await exercise(createFormData([["expiresInHours", expiresInHours]]));
  assert.deepEqual(result, { status: "disabled", reason: "malformed" });
  assertCredentialFreeDisabledResult(result);
  assert.equal(adapterCallCount, before);
}

for (const forbiddenField of [
  "assignmentId",
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
  "unknownField",
]) {
  const before = adapterCallCount;
  result = await exercise(createFormData([[forbiddenField, "forbidden"]]));
  assert.deepEqual(result, { status: "disabled", reason: "malformed" });
  assertCredentialFreeDisabledResult(result);
  assert.equal(adapterCallCount, before);
}

const duplicateTtlBefore = adapterCallCount;
result = await exercise(
  createFormData([
    ["expiresInHours", "72"],
    ["expiresInHours", "24"],
  ]),
);
assert.deepEqual(result, { status: "disabled", reason: "malformed" });
assertCredentialFreeDisabledResult(result);
assert.equal(adapterCallCount, duplicateTtlBefore);

result = await exercise(undefined, async () => ({
  status: "disabled",
  reason: "blocked_by_checklist",
  blockers: ["route_safety_incomplete"],
}));
assert.deepEqual(result, { status: "disabled", reason: "checklist_blocked" });
assertCredentialFreeDisabledResult(result);

result = await exercise(undefined, async () => ({
  status: "disabled",
  reason: "action_boundary_unavailable",
}));
assert.deepEqual(result, {
  status: "disabled",
  reason: "action_boundary_unavailable",
});
assertCredentialFreeDisabledResult(result);

result = await exercise(undefined, async () => {
  throw new Error("synthetic adapter failure must be suppressed");
});
assert.deepEqual(result, { status: "disabled", reason: "action_error" });
assertCredentialFreeDisabledResult(result);

result = await exercise(undefined, async () => ({
  status: "issued",
  responseUrl: "[synthetic credential that must not be returned]",
  expiresAt: "2030-01-01T00:00:00.000Z",
  warning: "synthetic warning",
}));
assert.deepEqual(result, { status: "disabled", reason: "not_approved" });
assertCredentialFreeDisabledResult(result);

assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE, false);

console.log("Assignment-detail disabled server-action stub regression passed.");
console.log("Confirmed disabled route binding without normal user submission and disabled-adapter-only execution.");
