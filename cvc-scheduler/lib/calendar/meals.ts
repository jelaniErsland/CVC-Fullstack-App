export type CalendarMeal = Readonly<{
  kind: "breakfast" | "lunch";
  provider: string | null;
  contact: string | null;
  menu: string | null;
  total: number | null;
}>;

export function parseCalendarMeal(row: Record<string, unknown>): CalendarMeal | null {
  if (row.meal_kind === null || row.meal_kind === undefined) return null;
  if (row.meal_kind !== "breakfast" && row.meal_kind !== "lunch") throw new Error("Invalid meal kind.");
  for (const key of ["meal_provider", "meal_contact", "meal_menu"]) {
    if (row[key] !== null && typeof row[key] !== "string") throw new Error("Invalid meal details.");
  }
  if (row.meal_total !== null && (!Number.isInteger(row.meal_total) || Number(row.meal_total) < 0)) throw new Error("Invalid meal total.");
  return {
    kind: row.meal_kind, provider: row.meal_provider as string | null,
    contact: row.meal_contact as string | null, menu: row.meal_menu as string | null,
    total: row.meal_total as number | null,
  };
}

export function mealLabel(kind: CalendarMeal["kind"]) {
  return kind === "breakfast" ? "Breakfast" : "Lunch";
}
