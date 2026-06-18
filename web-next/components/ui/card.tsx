import * as React from "react";
import { cn } from "@/lib/design/cn";

/**
 * Card — surface primitive.
 *
 * Standard card: white surface, 1px border, shadow-1.
 * `featured` variant adds a subtle gradient backdrop (per the
 * `gradient.surface.soft` token) and uses the brand-primary-100 border
 * to stand out in dashboards.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "featured" | "lift";
  as?: keyof React.JSX.IntrinsicElements;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "default", as: As = "div", ...props },
  ref,
) {
  const Comp = As as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={cn(
        "rounded-lg border bg-neutral-0 shadow-1 transition-all duration-200",
        variant === "featured"
          ? "border-brand-primary-100 bg-surface-soft"
          : variant === "lift"
            ? "border-neutral-200 hover:-translate-y-0.5 hover:shadow-2"
            : "border-neutral-200",
        className,
      )}
      {...props}
    />
  );
});

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-h4 text-text-heading", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-body-sm text-text-muted", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/**
 * CardDivider — thin horizontal rule for visual separation inside
 * card bodies without a full `<hr>` element.
 */
export function CardDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("-mx-5 my-4 border-t border-neutral-100", className)}
      aria-hidden
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
