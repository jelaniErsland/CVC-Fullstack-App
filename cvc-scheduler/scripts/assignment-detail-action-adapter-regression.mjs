import assert from "node:assert/strict";

import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
} from "../lib/assignments/detailResponseLinkEnablementChecklist.server.ts";
import { ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE } from "../lib/assignments/detailRouteEntryPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS,
  createAssignmentDetailResponseLinkDisabledAdapterWithDependencies,
  describeAssignmentDetailResponseLinkDisabledAdapter,
} from "../lib/responseTokens/productActionDisabledAdapter.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE } from "../lib/responseTokens/productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE } from "../lib/responseTokens/productActionWiringPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE,
} from "../lib/responseTokens/productActionPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "../lib/responseTokens/productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "../lib/responseTokens/revealPolicy.server.ts";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const allChecklistReadiness = {
  routeSafety: true,
  entrySafety: true,
  actionSafety: true,
  uiSafety: true,
  credentialLogSafety: true,
  browserProof: true,
  productOwnerCheckpoint: true,
};

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
  "accessToken",
  "refreshToken",
  "password",
  "serviceRoleKey",
  "sqlDetail",
  "sensitiveIntakeValue",
  "sensitiveIntakeData",
  "unrelatedRowMarker",
  "unrelatedRowData",
];

function assertCredentialFreeDisabledResult(result) {
  assert.equal(result.status, "disabled");
  const serialized = JSON.stringify(result);
  for (const fragment of forbiddenResultFragments) {
    assert.equal(
      serialized.includes(fragment),
      false,
      `disabled adapter result must not include ${fragment}`,
    );
  }
}

let productActionCallCount = 0;
async function productActionSpy() {
  productActionCallCount += 1;
  throw new Error("product action must remain unreachable while final approval is false");
}

async function exercise(input, readiness = allChecklistReadiness) {
  return createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(input, {
    readiness,
    productAction: productActionSpy,
  });
}

const description = describeAssignmentDetailResponseLinkDisabledAdapter();
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE, "disabled");
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
  false,
);
assert.equal(description.adapterAvailable, true);
assert.equal(description.defaultState, "disabled");
assert.equal(description.finalApprovalAvailable, false);
assert.deepEqual(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS, [
  "assignmentId",
  "expiresInHours",
]);
assert.deepEqual(description.allowedBrowserInputs, [
  "assignmentId",
  "expiresInHours",
]);

for (const forbiddenInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
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
]) {
  assert.ok(
    RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS.includes(
      forbiddenInput,
    ),
  );
  assert.ok(description.forbiddenBrowserInputs.includes(forbiddenInput));
}

const validMinimal = await exercise({ assignmentId });
assert.deepEqual(validMinimal, { status: "disabled", reason: "not_approved" });
assertCredentialFreeDisabledResult(validMinimal);
assert.equal(productActionCallCount, 0);

for (const expiresInHours of [1, 72, 168]) {
  const result = await exercise({ assignmentId, expiresInHours });
  assert.deepEqual(result, { status: "disabled", reason: "not_approved" });
  assertCredentialFreeDisabledResult(result);
}
assert.equal(productActionCallCount, 0);

for (const expiresInHours of [0, 169, 1.5, Number.NaN]) {
  const result = await exercise({ assignmentId, expiresInHours });
  assert.deepEqual(result, { status: "disabled", reason: "invalid_input" });
  assertCredentialFreeDisabledResult(result);
}
assert.equal(productActionCallCount, 0);

for (const malformedAssignmentId of [
  "",
  "not-a-uuid",
  "11111111-1111-1111-1111-111111111111",
  "11111111-1111-4111-7111-111111111111",
]) {
  const result = await exercise({ assignmentId: malformedAssignmentId });
  assert.deepEqual(result, { status: "disabled", reason: "invalid_input" });
  assertCredentialFreeDisabledResult(result);
}
assert.equal(productActionCallCount, 0);

for (const forbiddenInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
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
  "unknownField",
]) {
  const result = await exercise({ assignmentId, [forbiddenInput]: "forbidden" });
  assert.deepEqual(result, { status: "disabled", reason: "invalid_input" });
  assertCredentialFreeDisabledResult(result);
}
assert.equal(productActionCallCount, 0);

const blockedByChecklist =
  await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId },
    { productAction: productActionSpy },
  );
assert.equal(blockedByChecklist.status, "disabled");
assert.equal(blockedByChecklist.reason, "blocked_by_checklist");
assert.ok(blockedByChecklist.blockers.includes("route_safety_incomplete"));
assert.ok(blockedByChecklist.blockers.includes("product_owner_checkpoint_missing"));
assertCredentialFreeDisabledResult(blockedByChecklist);
assert.equal(productActionCallCount, 0);

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

console.log("Assignment-detail disabled action adapter regression passed.");
console.log("Confirmed credential-free disabled states and zero product-action calls.");
