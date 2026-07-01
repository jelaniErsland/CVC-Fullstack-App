const defaultAdminPath = "/admin/dashboard";

export function getSafeAdminRedirect(value: string | null | undefined) {
  if (
    !value ||
    (!value.startsWith("/admin/") && value !== "/admin") ||
    value.startsWith("//") ||
    value.startsWith("/admin/auth") ||
    value.startsWith("/admin/login")
  ) {
    return defaultAdminPath;
  }

  return value;
}
