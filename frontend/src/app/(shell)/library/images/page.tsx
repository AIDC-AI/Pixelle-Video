'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Copy, Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { LibraryFilterBar } from '@/components/library/library-filter-bar';
import { LibraryGrid } from '@/components/library/library-grid';
import { BulkActionBar } from '@/components/library/bulk-action-bar';
import { CompareView, type CompareAsset } from '@/components/library/compare-view';
import { ExifPanel } from '@/components/library/exif-panel';
import { Lightbox } from '@/components/library/lightbox';
import { MasonryGrid, MasonryGridItem } from '@/components/library/masonry-grid';
import { StarButton, useStarredAsset } from '@/components/library/star-button';
import { TagFilter } from '@/components/library/tag-filter';
import { readLibraryView, ViewToggle, writeLibraryView, type LibraryView } from '@/components/library/view-toggle';
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
import { useMultiSelect } from '@/lib/hooks/use-multi-select';
import { useProjects } from '@/lib/hooks/use-projects';
import { useAppTranslations } from '@/lib/i18n';
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
  onOpenDetails,
  onOpenLightbox,
  onSelect,
  projectLabel,
  selected,
}: {
  item: ImageItem;
  onOpenDetails: (item: ImageItem) => void;
  onOpenLightbox: () => void;
  onSelect: (event: React.MouseEvent<HTMLInputElement>) => void;
  projectLabel: string;
  selected: boolean;
}) {
  const t = useAppTranslations('library');
  const previewUrl = item.thumbnail_url ?? item.image_url ?? item.image_path;
  const { starred, toggleStarred } = useStarredAsset('images', item.id);

  return (
    <Card className="overflow-hidden border-border/70 bg-card shadow-none transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpenDetails(item)}
        aria-label={t('images.openAsset', { id: item.id })}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-muted/20">
          <input
            aria-label={`Select ${item.id}`}
            type="checkbox"
            checked={selected}
            className="absolute right-3 top-3 z-20 size-4"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(event);
            }}
            onChange={() => undefined}
          />
          <div className="absolute right-8 top-1 z-20">
            <StarButton size="sm" starred={starred} onToggle={toggleStarred} />
          </div>
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
          {item.prompt_used ?? t('images.noPromptSnapshot')}
        </p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenDetails(item)}>
            Details
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenLightbox}>
            Lightbox
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function imageTags(item: ImageItem): string[] {
  return [item.project_id ? 'project' : 'unassigned', item.batch_id ? 'batch' : 'single', item.prompt_used ? 'prompted' : null]
    .filter((tag): tag is string => Boolean(tag));
}

function LibraryImagesPageContent() {
  const t = useAppTranslations('library');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject, isHydrated, setCurrentProject } = useCurrentProjectHydration();
  const { data: projectsData } = useProjects();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [view, setView] = useState<LibraryView>(() => readLibraryView('images', 'grid'));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

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
  const selectableItems = useMemo(() => items.map((item) => ({ id: item.id, item })), [items]);
  const multiSelect = useMultiSelect(selectableItems);
  const tags = useMemo(() => Array.from(new Set(items.flatMap(imageTags))), [items]);
  const visibleItems = useMemo(
    () =>
      selectedTags.length === 0
        ? items
        : items.filter((item) => selectedTags.every((tag) => imageTags(item).includes(tag))),
    [items, selectedTags]
  );
  const selectedImageItems = visibleItems.filter((item) => multiSelect.isSelected(item.id));
  const compareItems: CompareAsset[] = selectedImageItems.map((item) => ({
    id: item.id,
    kind: 'image',
    metadata: {
      created: item.created_at,
      project: projectFilterLabel(item.project_id ?? '__unassigned__', projects),
      size: formatFileSize(item.file_size),
    },
    title: item.prompt_used ?? item.id,
    url: item.image_url ?? item.image_path,
  }));

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
  const isEmpty = !isInitialLoading && visibleItems.length === 0;

  const emptyDescription =
    projectFilter !== 'all'
      ? t('images.emptyProjectDescription', { project: projectFilterLabel(projectFilter, projects) })
      : t('images.emptyDescription');

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LibraryFilterBar
        title={t('images.title')}
        description={t('images.description')}
        projectFilter={projectFilter}
        projects={projects}
        projectLabel={t('filters.project')}
        allProjectsLabel={t('filters.allProjects')}
        selectId="library-images-project-filter"
        unassignedLabel={t('filters.unassigned')}
        onProjectFilterChange={handleProjectFilterChange}
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">View</span>
          <ViewToggle
            view={view}
            onViewChange={(nextView) => {
              setView(nextView);
              writeLibraryView('images', nextView);
            }}
          />
        </div>
        <TagFilter tags={tags} selected={selectedTags} onChange={setSelectedTags} />
      </LibraryFilterBar>

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
          title={projectFilter !== 'all' ? t('images.emptyProjectTitle') : t('images.emptyTitle')}
          description={emptyDescription}
          actionHref="/create"
          actionLabel={t('actions.goToCreate')}
        />
      ) : null}

      {!isInitialLoading && !isEmpty ? (
        <>
          <div className="flex justify-end">
            {selectedImageItems.length >= 2 && selectedImageItems.length <= 4 ? (
              <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
                Compare
              </Button>
            ) : null}
          </div>
          {view === 'grid' ? (
            <MasonryGrid>
              {visibleItems.map((item, index) => (
                <MasonryGridItem key={item.id}>
                  <ImageCard
                    item={item}
                    onOpenDetails={setSelectedImage}
                    onOpenLightbox={() => setLightboxIndex(index)}
                    projectLabel={projectFilterLabel(item.project_id ?? '__unassigned__', projects)}
                    selected={multiSelect.isSelected(item.id)}
                    onSelect={(event) => multiSelect.toggle(item.id, { index, shiftKey: event.shiftKey })}
                  />
                </MasonryGridItem>
              ))}
            </MasonryGrid>
          ) : (
            <LibraryGrid>
              {visibleItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
                  <input
                    aria-label={`Select ${item.id}`}
                    type="checkbox"
                    checked={multiSelect.isSelected(item.id)}
                    onClick={(event) => multiSelect.toggle(item.id, { index, shiftKey: event.shiftKey })}
                    onChange={() => undefined}
                  />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedImage(item)}>
                    <p className="truncate text-sm font-medium text-foreground">{item.prompt_used ?? item.id}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
                  </button>
                </div>
              ))}
            </LibraryGrid>
          )}

          {imagesQuery.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  void imagesQuery.fetchNextPage();
                }}
                disabled={imagesQuery.isFetchingNextPage}
              >
                {imagesQuery.isFetchingNextPage ? t('actions.loadingMore') : t('actions.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <Lightbox
        open={lightboxIndex !== null}
        images={visibleItems.map((item) => ({
          id: item.id,
          prompt: item.prompt_used,
          title: item.prompt_used ?? item.id,
          url: item.image_url ?? item.image_path,
        }))}
        initialIndex={lightboxIndex ?? 0}
        onOpenChange={(open) => !open && setLightboxIndex(null)}
        onDownload={(image) => window.open(image.url, '_blank', 'noopener,noreferrer')}
      />

      <Dialog open={Boolean(selectedImage)} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-background">
          <DialogHeader>
            <DialogTitle>{t('images.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('images.dialog.description')}
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
                  <p className="text-sm font-medium text-foreground">{t('images.dialog.promptSnapshot')}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedImage.prompt_used ?? t('images.dialog.noPromptStored')}
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('filters.project')}</span>
                    <span className="font-medium text-foreground">
                      {projectFilterLabel(selectedImage.project_id ?? '__unassigned__', projects)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('shared.created')}</span>
                    <span className="font-medium text-foreground">{formatRelativeTime(selectedImage.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('shared.size')}</span>
                    <span className="font-medium text-foreground">{formatFileSize(selectedImage.file_size)}</span>
                  </div>
                </div>
                <ExifPanel src={selectedImage.image_url ?? selectedImage.image_path} />
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
                  toast.success(t('images.dialog.promptCopied'));
                }}
              >
                <Copy className="size-4" />
                {t('images.dialog.copyPrompt')}
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
                  {t('actions.download')}
                </a>
              ) : null}
            </div>

            {selectedImage ? (
              <Link href={buildReuseHref(selectedImage)} className={buttonVariants()}>
                <Sparkles className="size-4" />
                {t('images.dialog.reuseInI2v')}
              </Link>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BulkActionBar
        selectedCount={selectedImageItems.length}
        onClearSelection={multiSelect.clear}
        onDelete={() => {
          toast.info('Delete will be available when the library bulk API ships.');
          multiSelect.clear();
        }}
        onDownload={() => {
          selectedImageItems.forEach((item) => window.open(item.image_url ?? item.image_path, '_blank', 'noopener,noreferrer'));
        }}
      />
      <CompareView open={compareOpen} onOpenChange={setCompareOpen} items={compareItems} />
    </div>
  );
}

export default function LibraryImagesPage() {
  const t = useAppTranslations('library');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingImages')}</div>}>
      <LibraryImagesPageContent />
    </Suspense>
  );
}
