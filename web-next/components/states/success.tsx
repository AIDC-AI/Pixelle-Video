import { CheckCircle2 } from "lucide-react";

/**
 * SuccessState — minimal confirmation.
 * Per spec: semantic success color, simple icon, short text.
 */
export function SuccessState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      role="status"
      className="rounded-lg border border-success/30 bg-success-soft px-6 py-6 text-center"
    >
      <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden />
      <h3 className="mt-3 text-h4 text-text-heading">{title}</h3>
      {description ? (
        <p className="mt-2 text-body-sm text-text-body">{description}</p>
      ) : null}
    </div>
  );
}
