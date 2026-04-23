import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface VideoResultProps {
  aspectRatio?: 'portrait' | 'landscape';
  videoUrl: string;
  duration?: number;
  fileSize?: number;
  onRegenerate: () => void;
}

export function VideoResult({
  aspectRatio = 'portrait',
  videoUrl,
  duration,
  fileSize,
  onRegenerate,
}: VideoResultProps) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(videoUrl);
    toast.success('链接已复制到剪贴板');
  };

  const aspectRatioClassName = aspectRatio === 'landscape' ? 'aspect-video' : 'aspect-[9/16]';

  return (
    <Card className="bg-card border-border shadow-none overflow-hidden">
      <CardHeader className="pb-3 border-b text-foreground">
        <CardTitle className="text-lg font-medium">生成结果</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`${aspectRatioClassName} bg-black relative max-h-[60vh] mx-auto flex items-center justify-center`}>
          <video 
            src={videoUrl} 
            controls 
            className="w-full h-full object-contain"
            autoPlay
            loop
            muted
          />
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            {duration !== undefined && <span>时长: {duration.toFixed(1)}s</span>}
            {fileSize !== undefined && <span>大小: {(fileSize / 1024 / 1024).toFixed(1)} MB</span>}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={handleCopyLink} className="w-full">
              <LinkIcon className="w-4 h-4 mr-2" />
              复制链接
            </Button>
            <Button
              nativeButton={false}
              variant="secondary"
              render={<a href={videoUrl} download target="_blank" rel="noreferrer" />}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              下载视频
            </Button>
          </div>
          
          <Button onClick={onRegenerate} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            基于此重生成
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
