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
    "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.20)] hover:bg-slate-800",
  secondary:
    "border border-white/80 bg-white/64 text-slate-900 shadow-sm hover:bg-white/86",
  ghost: "text-slate-600 hover:bg-white/56 hover:text-slate-950",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold",
    "transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
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
