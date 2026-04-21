import React from 'react';

export function PagePlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground text-sm max-w-md">{description}</p>
      <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs font-medium mt-4">Coming Soon</span>
    </div>
  );
}
