'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Copy, Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryGrid } from '@/components/library/library-grid';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProjectHydration } from '@/lib/hooks/use-current-project';
import { useLibraryImages } from '@/lib/hooks/use-library-assets';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  formatFileSize,
  formatRelativeTime,
  normalizeProjectFilterValue,
  projectFilterLabel,
} from '@/lib/pipeline-utils';
import { cn } from '@/lib/utils';
import type { components } from '@/types/api';

type ImageItem = components['schemas']['ImageItem'];

const DEFAULT_LIMIT = 12;

function buildReuseHref(item: ImageItem): string {
  const sourceImage = item.image_url ?? item.image_path;
  const params = new URLSearchParams({ source_image: sourceImage });
  return `/create/i2v?${params.toString()}`;
}

function ImageCard({
  item,
  onOpen,
  projectLabel,
}: {
  item: ImageItem;
  onOpen: (item: ImageItem) => void;
  projectLabel: string;
}) {
  const previewUrl = item.thumbnail_url ?? item.image_url ?? item.image_path;

  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpen(item)}
        aria-label={`Open ${item.id}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-muted/20">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={item.prompt_used ?? item.id}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="size-16 text-muted-foreground/60" />
            </div>
          )}
          <Badge className="absolute left-3 top-3 border-border/70 bg-background/85 text-foreground backdrop-blur-sm">
            {projectLabel}
          </Badge>
        </div>
      </button>
      <CardContent className="space-y-2 p-4">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {item.prompt_used ?? 'No prompt snapshot'}
        </p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
      </CardContent>
    </Card>
  );
}

function LibraryImagesPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  const limitParam = Number.parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT;
  const projectFilter = normalizeProjectFilterValue(searchParams.get('project_id'), currentProject?.id);
  const initialCursor = searchParams.get('cursor');

  const imagesQuery = useLibraryImages({
    initialCursor,
    limit,
    projectFilter,
  });

  const items = useMemo(() => (imagesQuery.data?.pages ?? []).flatMap((page) => page.items ?? []), [imagesQuery.data]);
  const projects = projectsData?.items ?? [];

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!searchParams.get('project_id') && currentProject?.id) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('project_id', currentProject.id);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    }
  }, [currentProject?.id, isHydrated, pathname, router, searchParams]);

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'all') {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    if ('project_id' in updates) {
      nextSearchParams.delete('cursor');
    }

    router.replace(
      nextSearchParams.toString() ? `${pathname}?${nextSearchParams.toString()}` : pathname,
      { scroll: false }
    );
  };

  const handleProjectFilterChange = (value: string | null) => {
    if (!value) {
      return;
    }

    const selectedProject = projects.find((project) => project.id === value);
    if (selectedProject) {
      setCurrentProject({ id: selectedProject.id, name: selectedProject.name });
    }

    updateSearchParams({ project_id: value });
  };

  const isInitialLoading = imagesQuery.isLoading || !isHydrated;
  const isEmpty = !isInitialLoading && items.length === 0;

  const emptyDescription =
    projectFilter !== 'all'
      ? `No image assets are indexed for ${projectFilterLabel(projectFilter, projects)}.`
      : 'Create or upload an image through a pipeline to build a reusable image library.';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title="Images"
        description="Browse generated stills and portrait assets, then reuse them directly in Image → Video flows."
        projectFilter={projectFilter}
        projects={projects}
        selectId="library-images-project-filter"
        onProjectFilterChange={handleProjectFilterChange}
      />

      {isInitialLoading ? (
        <LibraryGrid>
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={`image-skeleton-${index}`} aspectClassName="aspect-[3/4]" />
          ))}
        </LibraryGrid>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={ImageIcon}
          title={projectFilter !== 'all' ? 'This project has no images yet.' : 'No images indexed yet.'}
          description={emptyDescription}
          actionHref="/create"
          actionLabel="Go to Create"
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <LibraryGrid>
            {items.map((item) => (
              <ImageCard
                key={item.id}
                item={item}
                onOpen={setSelectedImage}
                projectLabel={projectFilterLabel(item.project_id ?? '__unassigned__', projects)}
              />
            ))}
          </LibraryGrid>

          {imagesQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void imagesQuery.fetchNextPage();
                }}
                disabled={imagesQuery.isFetchingNextPage}
              >
                {imagesQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <Dialog open={Boolean(selectedImage)} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-background">
          <DialogHeader>
            <DialogTitle>Reuse image asset</DialogTitle>
            <DialogDescription>
              Open a larger preview, copy the original prompt, or jump back into the Image → Video pipeline.
            </DialogDescription>
          </DialogHeader>

          {selectedImage ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
                <Image
                  src={selectedImage.image_url ?? selectedImage.image_path}
                  alt={selectedImage.prompt_used ?? selectedImage.id}
                  width={1280}
                  height={960}
                  unoptimized
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
                  <p className="text-sm font-medium text-foreground">Prompt snapshot</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedImage.prompt_used ?? 'No prompt snapshot stored for this asset.'}
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium text-foreground">
                      {projectFilterLabel(selectedImage.project_id ?? '__unassigned__', projects)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium text-foreground">{formatRelativeTime(selectedImage.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium text-foreground">{formatFileSize(selectedImage.file_size)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!selectedImage?.prompt_used}
                onClick={async () => {
                  if (!selectedImage?.prompt_used || !navigator.clipboard?.writeText) {
                    return;
                  }

                  await navigator.clipboard.writeText(selectedImage.prompt_used);
                  toast.success('Prompt copied.');
                }}
              >
                <Copy className="size-4" />
                Copy Prompt
              </Button>

              {selectedImage ? (
                <a
                  href={selectedImage.image_url ?? selectedImage.image_path}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  <Download className="size-4" />
                  Download
                </a>
              ) : null}
            </div>

            {selectedImage ? (
              <Link href={buildReuseHref(selectedImage)} className={buttonVariants()}>
                <Sparkles className="size-4" />
                Reuse in Image → Video
              </Link>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LibraryImagesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading images…</div>}>
      <LibraryImagesPageContent />
    </Suspense>
  );
}
