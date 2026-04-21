import React from 'react';
import { Sparkles, User, Image as ImageIcon, Activity, PenTool } from 'lucide-react';
import { PipelineCard } from '@/components/create/pipeline-card';
import { QuickIntentInput } from '@/components/create/quick-intent-input';

export default function CreateHeroPage() {
  return (
    <div className="h-full flex flex-col pt-12 pb-24 max-w-[1200px] mx-auto px-4 md:px-8">
      <div className="text-center space-y-6 mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          你想创作什么视频？
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          输入一个想法，或者选择下方的专业流水线，让引擎为你自动化生成完整的视频。
        </p>
      </div>

      <div className="mb-16">
        <QuickIntentInput />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        <div className="lg:col-span-2">
          <PipelineCard
            title="Quick Pipeline"
            description="最快速的视频生成方式。输入创意描述，系统自动编写脚本、配音并生成分镜视频。"
            timeEstimate="约 2-5 分钟"
            icon={Sparkles}
            href="/create/quick"
          />
        </div>
        
        <PipelineCard
          title="Digital Human"
          description="数字人播报生成。选择虚拟主播，输入文本，一键生成口型同步的播报视频。"
          timeEstimate="约 5-10 分钟"
          icon={User}
          href="/create/digital-human"
        />

        <PipelineCard
          title="Image to Video"
          description="图片转视频。上传一张或多张图片，使用高级动画模型让静态图像动起来。"
          timeEstimate="约 3-8 分钟"
          icon={ImageIcon}
          href="/create/i2v"
        />

        <PipelineCard
          title="Action Transfer"
          description="动作迁移视频。提供动作视频和目标形象，将动作完美复刻到新形象上。"
          timeEstimate="约 10-20 分钟"
          icon={Activity}
          href="/create/action-transfer"
        />

        <PipelineCard
          title="Custom Asset"
          description="自定义资产生成。按需生成独立的配音、配乐、背景图片或短视频片段。"
          timeEstimate="约 1-3 分钟"
          icon={PenTool}
          href="/create/custom"
        />
      </div>
    </div>
  );
}
