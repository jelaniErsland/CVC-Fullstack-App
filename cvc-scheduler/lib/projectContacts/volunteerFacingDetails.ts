export type VolunteerFacingContactDetails = Readonly<{
  displayName: string | null;
  email: string | null;
  phone: string | null;
}>;

export type VolunteerFacingContactDetailsInput = Readonly<{
  displayName: unknown;
  email: unknown;
  phone: unknown;
}>;

export class VolunteerFacingContactDetailsValidationError extends Error {}

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const unsafeRichTextPattern = /[<>\u0000-\u001f\u007f]/;

function normalizeRequiredText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string") {
    throw new VolunteerFacingContactDetailsValidationError(`${label} is invalid.`);
  }
  const normalized = value.trim();
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    unsafeRichTextPattern.test(normalized)
  ) {
    throw new VolunteerFacingContactDetailsValidationError(`${label} is invalid.`);
  }
  return normalized;
}

export function normalizeVolunteerFacingContactDetailsInput(
  input: VolunteerFacingContactDetailsInput | unknown,
): Readonly<{ displayName: string; email: string; phone: string | null }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new VolunteerFacingContactDetailsValidationError("Follow-up Contact details are invalid.");
  }
  const candidate = input as Record<string, unknown>;
  const displayName = normalizeRequiredText(candidate.displayName, "Name", 1, 160);
  const email = normalizeRequiredText(candidate.email, "Email", 3, 254).toLowerCase();
  if (!emailPattern.test(email)) {
    throw new VolunteerFacingContactDetailsValidationError("Email is invalid.");
  }
  const rawPhone = candidate.phone;
  const phone =
    rawPhone === null ||
    rawPhone === undefined ||
    (typeof rawPhone === "string" && rawPhone.trim() === "")
      ? null
      : normalizeRequiredText(rawPhone, "Phone", 7, 40);
  return { displayName, email, phone };
}
