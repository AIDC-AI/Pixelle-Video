'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, LoaderCircle, RefreshCcw, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { paths } from '@/types/api';

type UploadResponse = paths['/api/uploads']['post']['responses'][201]['content']['application/json'];

type MediaKind = 'image' | 'video' | 'audio' | 'unknown';

interface MediaUploaderProps {
  accept: string;
  disabled?: boolean;
  inputLabel?: string;
  maxSize?: number;
  onChange: (url: string | null) => void;
  value?: string | null;
}

const DEFAULT_MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function formatMegabytes(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1);
}

function parseAcceptList(accept: string): string[] {
  return accept
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferMediaKindFromAccept(accept: string): MediaKind {
  const acceptedTypes = parseAcceptList(accept);
  if (acceptedTypes.some((item) => item.startsWith('image/'))) {
    return acceptedTypes.length === 1 ? 'image' : 'unknown';
  }
  if (acceptedTypes.some((item) => item.startsWith('video/'))) {
    return acceptedTypes.length === 1 ? 'video' : 'unknown';
  }
  if (acceptedTypes.some((item) => item.startsWith('audio/'))) {
    return acceptedTypes.length === 1 ? 'audio' : 'unknown';
  }
  return 'unknown';
}

function inferMediaKindFromUrl(url: string, accept: string): MediaKind {
  const lowerUrl = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(lowerUrl)) {
    return 'image';
  }
  if (/\.(mp4|mov|m4v|webm|avi|mkv)$/.test(lowerUrl)) {
    return 'video';
  }
  if (/\.(mp3|wav|aac|ogg|m4a|flac)$/.test(lowerUrl)) {
    return 'audio';
  }
  return inferMediaKindFromAccept(accept);
}

function matchesAcceptedType(file: File, accept: string): boolean {
  const acceptedTypes = parseAcceptList(accept);
  if (acceptedTypes.length === 0) {
    return true;
  }

  const fileName = file.name.toLowerCase();

  return acceptedTypes.some((acceptedType) => {
    if (acceptedType.endsWith('/*')) {
      const prefix = acceptedType.slice(0, acceptedType.indexOf('/'));
      return file.type.startsWith(`${prefix}/`);
    }

    if (acceptedType.startsWith('.')) {
      return fileName.endsWith(acceptedType.toLowerCase());
    }

    return file.type === acceptedType;
  });
}

function getFileKind(file: File): MediaKind {
  if (file.type.startsWith('image/')) {
    return 'image';
  }
  if (file.type.startsWith('video/')) {
    return 'video';
  }
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'unknown';
}

function toErrorMessage(status: number, statusText: string, responseText: string): string {
  if (!responseText.trim()) {
    return statusText || 'Upload failed.';
  }

  try {
    const payload = JSON.parse(responseText) as
      | { detail?: { code?: string; message?: string } | string; message?: string }
      | null;

    if (payload?.detail && typeof payload.detail === 'object') {
      return payload.detail.message ?? payload.detail.code ?? statusText ?? 'Upload failed.';
    }
    if (typeof payload?.detail === 'string') {
      return payload.detail;
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    return statusText || 'Upload failed.';
  }

  return statusText || 'Upload failed.';
}

export function MediaUploader({
  accept,
  disabled = false,
  inputLabel = 'Upload media file',
  maxSize = DEFAULT_MAX_UPLOAD_SIZE,
  onChange,
  value,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<MediaKind | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptedTypes = useMemo(() => parseAcceptList(accept), [accept]);
  const previewKind = value
    ? inferMediaKindFromUrl(value, accept)
    : selectedKind ?? inferMediaKindFromAccept(accept);

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.size > maxSize) {
      setErrorMessage(`File exceeds the ${formatMegabytes(maxSize)} MB limit.`);
      return;
    }

    if (!matchesAcceptedType(file, accept)) {
      setErrorMessage(`Only ${acceptedTypes.join(', ')} files are accepted.`);
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setProgress(0);
    setSelectedKind(getFileKind(file));

    const formData = new FormData();
    formData.append('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE_URL}/api/uploads`);
    request.responseType = 'text';

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      setProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      setIsUploading(false);

      if (request.status < 200 || request.status >= 300) {
        setErrorMessage(toErrorMessage(request.status, request.statusText, request.responseText));
        return;
      }

      try {
        const response = JSON.parse(request.responseText) as UploadResponse;
        setProgress(100);
        onChange(response.file_url);
      } catch {
        setErrorMessage('Upload finished but the response could not be parsed.');
      }
    };

    request.onerror = () => {
      setIsUploading(false);
      setErrorMessage('Upload failed due to a network error.');
    };

    request.onabort = () => {
      setIsUploading(false);
      setErrorMessage('Upload was cancelled.');
    };

    request.send(formData);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  };

  const handleClear = () => {
    setErrorMessage(null);
    setProgress(0);
    setSelectedKind(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const renderPreview = () => {
    if (!value) {
      return null;
    }

    if (previewKind === 'image') {
      return (
        <div className="relative h-64 w-full">
          <Image
            src={value}
            alt="Uploaded preview"
            fill
            unoptimized
            className="rounded-lg object-cover"
          />
        </div>
      );
    }
    if (previewKind === 'video') {
      return (
        <video
          src={value}
          controls
          aria-label="Uploaded video preview"
          className="h-full w-full rounded-lg object-cover"
        />
      );
    }
    if (previewKind === 'audio') {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/40 p-4">
          <audio src={value} controls aria-label="Uploaded audio preview" className="w-full" />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
        Uploaded file ready.
      </div>
    );
  };

  const limitLabel = `${formatMegabytes(maxSize)} MB max`;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        aria-label={inputLabel}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {!value ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            'flex h-48 w-full flex-col gap-3 border-dashed bg-background px-6 py-8 text-center shadow-none',
            isDragging && 'border-primary bg-primary/5',
            disabled && 'cursor-not-allowed opacity-60'
          )}
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !isUploading) {
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {isUploading ? <LoaderCircle className="size-6 animate-spin" /> : <Upload className="size-6" />}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">Click or drag a file here</div>
            <div className="text-xs text-muted-foreground">
              Accepted: {acceptedTypes.join(', ')} · {limitLabel}
            </div>
          </div>
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border bg-card">{renderPreview()}</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCcw className="size-4" />
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={disabled || isUploading}
              onClick={handleClear}
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {isUploading ? <Progress value={progress} aria-label="Upload progress" /> : null}

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
