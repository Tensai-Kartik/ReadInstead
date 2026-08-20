import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Zap,
  ListOrdered,
  Lightbulb,
  BookOpen,
  Clock,
  Play,
  Copy,
  Check,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Dropdown, DropdownOption } from '../common/Dropdown';
import { SummaryContent, SummaryType } from '../../types';
import { cn } from '../../lib/utils';

export interface SummaryTabProps {
  summary: SummaryContent;
  onSeekTimestamp?: (seconds: number) => void;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ summary, onSeekTimestamp }) => {
  const [selectedType, setSelectedType] = useState<SummaryType>('executive');
  const [copied, setCopied] = useState(false);

  const dropdownOptions: DropdownOption<SummaryType>[] = [
    { value: 'executive', label: 'Executive Summary', icon: <FileText className="w-4 h-4" /> },
    { value: 'tldr', label: 'TL;DR (2-3 lines)', icon: <Zap className="w-4 h-4" /> },
    { value: 'detailed', label: 'Detailed Notes', icon: <ListOrdered className="w-4 h-4" /> },
    { value: 'takeaways', label: 'Key Takeaways', icon: <Lightbulb className="w-4 h-4" /> },
    { value: 'concepts', label: 'Important Concepts', icon: <BookOpen className="w-4 h-4" /> },
    { value: 'timeline', label: 'Chapter Timeline', icon: <Clock className="w-4 h-4" /> },
  ];

  const handleCopySummary = () => {
    let contentToCopy = '';
    if (selectedType === 'executive') contentToCopy = summary.executive_summary;
    else if (selectedType === 'tldr') contentToCopy = summary.tldr;
    else if (selectedType === 'detailed') contentToCopy = summary.detailed_notes.join('\n\n');
    else if (selectedType === 'takeaways') contentToCopy = summary.key_takeaways.join('\n\n');
    else if (selectedType === 'concepts') contentToCopy = summary.important_concepts.map(c => `${c.term}: ${c.definition}`).join('\n');
    else if (selectedType === 'timeline') contentToCopy = summary.chapter_timeline.map(t => `${t.time} - ${t.title}: ${t.description}`).join('\n');

    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4 shadow-soft-md h-full justify-between">
      {/* Top Header & Dropdown selector */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border-dark min-h-[42px]">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-200/60 dark:border-primary-800/50 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Insights
          </span>
          <button
            onClick={handleCopySummary}
            title={copied ? 'Copied!' : 'Copy Summary'}
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <Dropdown<SummaryType>
          options={dropdownOptions}
          value={selectedType}
          onChange={setSelectedType}
          className="w-48 sm:w-56"
        />
      </div>

      {/* Summary Viewport Content */}
      <div className="flex-1 min-h-[320px] max-h-[480px] overflow-y-auto pr-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedType}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
          >
            {/* 1. Executive Summary */}
            {selectedType === 'executive' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  Executive Summary
                </h3>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50/70 dark:bg-[#161923] p-4 rounded-2xl border border-gray-100 dark:border-[#232736]">
                  {summary.executive_summary}
                </p>
              </div>
            )}

            {/* 2. TL;DR */}
            {selectedType === 'tldr' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  ⚡ TL;DR (2-3 Lines)
                </h3>
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-sm font-medium leading-relaxed">
                  {summary.tldr}
                </div>
              </div>
            )}

            {/* 3. Detailed Notes */}
            {selectedType === 'detailed' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  Detailed Notes
                </h3>
                <div className="flex flex-col gap-2.5">
                  {summary.detailed_notes.map((note, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-[#161923] border border-gray-200/60 dark:border-[#232736] text-xs text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Key Takeaways */}
            {selectedType === 'takeaways' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Key Takeaways
                </h3>
                <div className="flex flex-col gap-2.5">
                  {summary.key_takeaways.map((takeaway, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex items-start gap-3"
                    >
                      <Lightbulb className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Important Concepts */}
            {selectedType === 'concepts' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Important Concepts & Terms
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {summary.important_concepts.map((concept, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 flex flex-col gap-1"
                    >
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                        {concept.term}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {concept.definition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Chapter Timeline */}
            {selectedType === 'timeline' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-primary-600 dark:text-primary-400">
                  Chapter-wise Timeline
                </h3>
                <div className="flex flex-col gap-2">
                  {summary.chapter_timeline.map((chap, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSeekTimestamp && onSeekTimestamp(chap.seconds)}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-[#161923] border border-gray-200/60 dark:border-[#232736] hover:border-primary-400 dark:hover:border-primary-600 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 text-xs font-mono font-bold flex items-center gap-1 group-hover:scale-105 transition-transform">
                          <Play className="w-3 h-3 fill-current" />
                          {chap.time}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {chap.title}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {chap.description}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Jump →
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
};
