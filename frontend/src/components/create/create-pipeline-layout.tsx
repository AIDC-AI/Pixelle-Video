'use client';

import React from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

interface CreatePipelineLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  statusPanel: React.ReactNode;
}

export function CreatePipelineLayout({
  title,
  description,
  children,
  statusPanel,
}: CreatePipelineLayoutProps) {
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 text-foreground md:flex-row md:flex-nowrap md:p-0">
      <div className="min-w-0 md:basis-[70%] md:pr-4">
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>

        <ScrollArea className="h-[calc(100vh-160px)] pr-4">{children}</ScrollArea>
      </div>

      <div className="w-full md:basis-[30%]">{statusPanel}</div>
    </div>
  );
}
