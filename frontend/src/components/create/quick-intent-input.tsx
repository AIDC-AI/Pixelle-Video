'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';

export function QuickIntentInput() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      router.push(`/create/quick?topic=${encodeURIComponent(topic.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Sparkles className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
      </div>
      <input
        type="text"
        className="w-full h-14 pl-12 pr-24 bg-card border border-border rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        placeholder="描述你的创意，比如：用像素风介绍宇宙大爆炸..."
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <div className="absolute inset-y-0 right-2 flex items-center">
        <button
          type="submit"
          disabled={!topic.trim()}
          className="h-10 px-4 bg-primary text-primary-foreground font-medium rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center"
        >
          <Search className="w-4 h-4 mr-2" />
          生成
        </button>
      </div>
    </form>
  );
}
