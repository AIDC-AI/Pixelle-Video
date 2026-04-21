import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PipelineCardProps {
  title: string;
  description: string;
  timeEstimate: string;
  icon: LucideIcon;
  href: string;
}

export function PipelineCard({ title, description, timeEstimate, icon: Icon, href }: PipelineCardProps) {
  return (
    <Link href={href}>
      <Card className="group relative overflow-hidden flex flex-col p-6 h-full transition-all duration-150 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary border-border bg-card">
        <div className="mb-4">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center transition-colors group-hover:bg-primary/10">
            <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
        <h3 className="font-semibold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground flex-1 mb-4">
          {description}
        </p>
        <div className="text-xs font-medium text-muted-foreground mt-auto border-t border-border pt-4">
          ⏱ {timeEstimate}
        </div>
      </Card>
    </Link>
  );
}
