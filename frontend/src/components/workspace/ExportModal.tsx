import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileText,
  FileCode,
  FileSpreadsheet,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { ProcessedVideo, ExportFormat, ExportOptions } from '../../types';
import { Button } from '../common/Button';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: ProcessedVideo;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, video }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [options, setOptions] = useState<ExportOptions>({
    includeSummary: true,
    includeTakeaways: true,
    includeQuestions: true,
    includeFlashcards: true,
    includeNotes: true,
  });

  if (!isOpen) return null;

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generateExportText = (): string => {
    let output = `# ${video.title}\n`;
    output += `**Source**: ${video.youtube_url}\n`;
    output += `**Channel**: ${video.channel} | **Duration**: ${video.duration} | **Processed**: ${video.processed_at}\n\n`;
    output += `---\n\n`;

    if (options.includeSummary && video.summary) {
      output += `## Executive Summary\n${video.summary.executive_summary}\n\n`;
      output += `## TL;DR\n${video.summary.tldr}\n\n`;
      output += `## Detailed Notes\n`;
      video.summary.detailed_notes.forEach((note, i) => {
        output += `${i + 1}. ${note}\n`;
      });
      output += `\n`;
    }

    if (options.includeTakeaways && video.summary?.key_takeaways) {
      output += `## Key Takeaways\n`;
      video.summary.key_takeaways.forEach((takeaway) => {
        output += `- ${takeaway}\n`;
      });
      output += `\n`;

      if (video.summary.important_concepts?.length) {
        output += `## Important Concepts\n`;
        video.summary.important_concepts.forEach((c) => {
          output += `- **${c.term}**: ${c.definition}\n`;
        });
        output += `\n`;
      }
    }

    if (options.includeQuestions && video.questions?.length) {
      output += `## Questions & Answers\n`;
      video.questions.forEach((q, idx) => {
        output += `### Q${idx + 1}: ${q.question_text} (${q.difficulty} - ${q.question_type})\n`;
        if (q.options?.length) {
          q.options.forEach((opt) => (output += `  - ${opt}\n`));
        }
        output += `**Answer**: ${q.correct_answer}\n`;
        output += `**Explanation**: ${q.explanation}\n\n`;
      });
    }

    if (options.includeFlashcards && video.flashcards?.length) {
      output += `## Flashcards\n`;
      video.flashcards.forEach((fc, idx) => {
        output += `### Card ${idx + 1}\n**Front**: ${fc.front}\n**Back**: ${fc.back}\n\n`;
      });
    }

    if (options.includeNotes && video.personal_note) {
      output += `## Personal Notes\n${video.personal_note}\n\n`;
    }

    return output;
  };

  const handleDownload = () => {
    const textContent = generateExportText();

    if (selectedFormat === 'pdf') {
      // Create clean printable iframe preview window for PDF output
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${video.title} - ReadInstead Export</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; padding: 40px; max-w: 800px; margin: 0 auto; }
                h1 { font-size: 24px; color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                h2 { font-size: 18px; color: #1f2937; margin-top: 24px; }
                ul, ol { padding-left: 20px; }
                li { margin-bottom: 6px; }
                .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
                .box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; rounded: 8px; margin-bottom: 12px; }
              </style>
            </head>
            <body>
              <div>${textContent.replace(/\n/g, '<br/>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>')}</div>
              <script>window.print();</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      const ext = selectedFormat === 'markdown' ? 'md' : 'txt';
      const mimeType = selectedFormat === 'markdown' ? 'text/markdown' : 'text/plain';
      const blob = new Blob([textContent], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_readinstead.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-[#12151e] rounded-3xl border border-gray-200 dark:border-[#232736] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-dark bg-gray-50/50 dark:bg-card-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                Export Learning Material
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Zero AI API calls • Generated from local stored database payload
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Format Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              1. Select Export Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'markdown', label: 'Markdown (.md)', icon: <FileCode className="w-4 h-4" /> },
                { id: 'pdf', label: 'PDF Document', icon: <FileText className="w-4 h-4" /> },
                { id: 'txt', label: 'Plain Text (.txt)', icon: <FileSpreadsheet className="w-4 h-4" /> },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id as ExportFormat)}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                    selectedFormat === fmt.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400'
                      : 'border-gray-200 dark:border-[#232736] bg-gray-50 dark:bg-[#161923] text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {fmt.icon}
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              2. Select Content Sections
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'includeSummary', label: 'Executive & TL;DR Summary' },
                { key: 'includeTakeaways', label: 'Key Takeaways & Concepts' },
                { key: 'includeQuestions', label: 'Adaptive Questions & Answers' },
                { key: 'includeFlashcards', label: 'Flashcards Stack' },
                { key: 'includeNotes', label: 'Personal Study Notes' },
              ].map((opt) => {
                const isChecked = options[opt.key as keyof ExportOptions];
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleOption(opt.key as keyof ExportOptions)}
                    className={`p-3 rounded-xl border text-left font-medium flex items-center justify-between transition-colors ${
                      isChecked
                        ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 font-semibold'
                        : 'border-gray-200 dark:border-[#232736] bg-gray-50 dark:bg-[#161923] text-gray-500'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        isChecked
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-border-dark bg-gray-50/50 dark:bg-card-dark">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download {selectedFormat.toUpperCase()}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
