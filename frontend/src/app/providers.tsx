'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppToaster } from '@/components/shared/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <AppToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
