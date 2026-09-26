import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  pending?: boolean;
  pendingLabel?: string;
};

type LinkButtonProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type NativeButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

const variants = {
  primary:
    "bg-[var(--pl-blue)] text-white shadow-sm hover:bg-[var(--pl-blue-deep)]",
  secondary:
    "border border-[var(--pl-border)] bg-white text-[var(--pl-ink)] shadow-sm hover:border-blue-200 hover:bg-[var(--pl-blue-soft)]",
  ghost: "text-[var(--pl-text)] hover:bg-[var(--pl-blue-soft)] hover:text-[var(--pl-ink)]",
  destructive: "bg-red-700 text-white hover:bg-red-800",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  pending = false,
  pendingLabel,
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-[var(--pl-control-height)] items-center justify-center gap-2 rounded-[var(--pl-radius-control)] px-4 py-2 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
    "transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    variants[variant],
    className,
  ].join(" ");

  if ("href" in props) {
    if (pending) return <span role="link" aria-disabled="true" aria-busy="true" className={`${classes} opacity-50`}>{pendingLabel ?? children}</span>;
    const { href, ...linkProps } = props as LinkButtonProps;

    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as NativeButtonProps;

  return (
    <button className={classes} {...buttonProps} disabled={pending || buttonProps.disabled} aria-busy={pending || undefined}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
