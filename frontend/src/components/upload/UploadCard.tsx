import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Upload, Link as LinkIcon, FileVideo, Sparkles, ArrowRight } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { cn } from '../../lib/utils';

export interface UploadCardProps {
  onStartProcessing: (urlOrFile: string | File) => void;
}

export const UploadCard: React.FC<UploadCardProps> = ({ onStartProcessing }) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'file'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    onStartProcessing(youtubeUrl.trim());
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileSubmit = () => {
    if (selectedFile) {
      onStartProcessing(selectedFile);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto p-6 sm:p-10 flex flex-col gap-6 shadow-soft-lg border-gray-200/80 dark:border-border-dark">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center text-white shadow-soft-md shadow-primary-500/30 mb-1">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Summarize Any Video
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Save time by reading instead of watching. Paste any YouTube link or upload a video file to get instant executive summaries, key takeaways, timelines, and Q&A.
        </p>
      </div>

      {/* Tab Selectors */}
      <div className="flex items-center justify-center gap-2 p-1.5 bg-gray-100 dark:bg-[#161923] rounded-2xl max-w-sm mx-auto border border-gray-200/60 dark:border-[#232736]">
        <button
          onClick={() => setActiveTab('youtube')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all',
            activeTab === 'youtube'
              ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-soft-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <Video className="w-4 h-4 text-red-500" />
          <span>YouTube Link</span>
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all',
            activeTab === 'file'
              ? 'bg-white dark:bg-card-dark text-primary-600 dark:text-primary-400 shadow-soft-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <Upload className="w-4 h-4 text-primary-500" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Mode 1: YouTube Link Input */}
      {activeTab === 'youtube' && (
        <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-4 mt-2">
          <Input
            placeholder="Paste YouTube link here..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            leftIcon={<LinkIcon className="w-4 h-4" />}
            className="py-3 text-base"
          />

          <Button
            type="submit"
            size="lg"
            disabled={!youtubeUrl.trim()}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full"
          >
            Process Video
          </Button>
        </form>
      )}

      {/* Mode 2: MP4 Drag & Drop Upload Zone */}
      {activeTab === 'file' && (
        <div className="flex flex-col gap-4 mt-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            className={cn(
              'border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer',
              dragActive
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30'
                : 'border-gray-200 dark:border-[#232736] hover:border-primary-300 dark:hover:border-primary-700/60 bg-gray-50/50 dark:bg-[#161923]/50'
            )}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept="video/mp4,video/mkv,video/webm"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <FileVideo className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Click to replace file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Drag and drop your MP4 video here
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Supports MP4, MKV, WebM up to 500MB
                </p>
              </div>
            )}
          </div>

          {selectedFile && (
            <Button
              onClick={handleFileSubmit}
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full"
            >
              Process Uploaded Video
            </Button>
          )}
        </div>
      )}

      {/* Bottom Footer Hint */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
        We support YouTube links and MP4 files. All transcriptions are automatically indexed.
      </p>
    </Card>
  );
};
