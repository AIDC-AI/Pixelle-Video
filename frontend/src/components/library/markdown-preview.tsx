'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownPreviewProps {
  markdown: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
}

function countWords(markdown: string): number {
  const compact = markdown.trim();
  if (!compact) {
    return 0;
  }

  const latinWords = compact.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? [];
  const cjkChars = compact.match(/[\u3400-\u9fff]/g) ?? [];
  return latinWords.length + cjkChars.length;
}

export function estimateSpeechMinutes(wordCount: number): number {
  return wordCount / 180;
}

export function MarkdownPreview({ markdown, onChange, readOnly = false }: MarkdownPreviewProps) {
  const wordCount = countWords(markdown);
  const speechMinutes = estimateSpeechMinutes(wordCount);
  const showEditor = !readOnly;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        <span>~{Math.max(1, Math.ceil(speechMinutes))} min spoken</span>
      </div>
      <div className={showEditor ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
        {showEditor ? (
          <textarea
            aria-label="Markdown editor"
            value={markdown}
            onChange={(event) => onChange?.(event.target.value)}
            className="min-h-56 rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : null}
        <div className="prose prose-sm max-w-none rounded-xl border border-border/70 bg-card p-4 text-foreground dark:prose-invert">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
