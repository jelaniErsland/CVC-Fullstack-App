import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";

/** Utility actions only. Consequential actions retain visible wording. */
export function IconButton({ label, children, variant = "ghost", ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  label: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost";
}) {
  return <Button type="button" {...props} variant={variant} aria-label={label} title={label} className={`min-h-11 min-w-11 shrink-0 px-2 ${props.className ?? ""}`}>{children}</Button>;
}
