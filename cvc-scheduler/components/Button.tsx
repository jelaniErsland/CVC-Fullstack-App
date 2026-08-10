import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
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
    "bg-[var(--pl-blue)] text-white shadow-[0_8px_18px_rgba(23,105,255,0.22)] hover:bg-[var(--pl-blue-deep)]",
  secondary:
    "border border-[var(--pl-border)] bg-white text-[var(--pl-ink)] shadow-sm hover:border-blue-200 hover:bg-[var(--pl-blue-soft)]",
  ghost: "text-[var(--pl-text)] hover:bg-[var(--pl-blue-soft)] hover:text-[var(--pl-ink)]",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-[var(--pl-control-height)] items-center justify-center rounded-[var(--pl-radius-control)] px-4 text-sm font-semibold",
    "transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    variants[variant],
    className,
  ].join(" ");

  if ("href" in props) {
    const { href, ...linkProps } = props as LinkButtonProps;

    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as NativeButtonProps;

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
