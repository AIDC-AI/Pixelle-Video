export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Skip to main content
    </a>
  );
}
