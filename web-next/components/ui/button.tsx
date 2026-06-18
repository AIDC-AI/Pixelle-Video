"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "@/components/states/loading";
import { cn } from "@/lib/design/cn";

/**
 * Button — 5 variants per the spec.
 *
 * - primary  → gold→red horizontal gradient, dark navy text, gold border & glow shadow
 * - secondary → white surface, navy text, hover bg-primary-50
 * - tertiary  → transparent, navy text, hover bg-primary-50
 * - destructive → solid semantic error, no gradient
 * - ghost     → minimal text-only link-style
 *
 * The 44px minimum height satisfies the Accessibility Rules.
 */
const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-body font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-300 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[image:var(--gradient-text)] text-[#011634] border border-brand-gold-500 font-bold shadow-[0_4px_14px_rgba(212,168,83,0.25)] hover:shadow-[0_6px_22px_rgba(212,168,83,0.45)] hover:opacity-95 active:opacity-90 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:border-transparent disabled:shadow-none",
        secondary:
          "border border-neutral-300 bg-neutral-0 text-brand-primary-800 hover:bg-brand-primary-50 hover:border-brand-primary-300",
        tertiary:
          "bg-transparent text-brand-primary-700 hover:bg-brand-primary-50",
        destructive:
          "bg-error text-neutral-0 shadow-1 hover:bg-red-700 active:bg-red-800",
        ghost:
          "bg-transparent text-brand-primary-700 hover:bg-brand-primary-50 px-3",
      },
      size: {
        md: "h-11 px-5",
        sm: "h-9 px-3 text-body-sm",
        lg: "h-12 px-6 text-body-lg",
        icon: "h-11 w-11 px-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      type = "button",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? <Spinner className="h-4 w-4" /> : null}
        {children}
      </button>
    );
  },
);

export { buttonVariants };
