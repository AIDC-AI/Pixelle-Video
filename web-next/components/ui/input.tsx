"use client";

import * as React from "react";
import { cn } from "@/lib/design/cn";

/**
 * Input — branded form control.
 *
 * - 44px minimum height (`h-11`).
 * - Focus ring `brand-primary-300` outside + `brand-primary-600` border.
 * - 16px font-size (mobile iOS zoom guard).
 * - `aria-invalid` flips the border + ring to the semantic error color.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full rounded-md border bg-neutral-0 px-3 text-body text-neutral-800 placeholder:text-neutral-400",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
          invalid
            ? "border-error focus:border-error focus:ring-error/30"
            : "border-neutral-300 focus:border-brand-primary-600 focus:ring-brand-primary-300",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-[88px] w-full rounded-md border bg-neutral-0 px-3 py-2 text-body text-neutral-800 placeholder:text-neutral-400",
          "transition-colors focus:outline-none focus:ring-2",
          "disabled:cursor-not-allowed disabled:bg-neutral-100",
          invalid
            ? "border-error focus:border-error focus:ring-error/30"
            : "border-neutral-300 focus:border-brand-primary-600 focus:ring-brand-primary-300",
          className,
        )}
        {...props}
      />
    );
  },
);

export interface FieldProps {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
}: FieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-label font-medium text-neutral-700"
      >
        {label}
        {required ? (
          <span className="ml-1 text-error" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-caption text-neutral-500">{help}</p>
      ) : null}
    </div>
  );
}
