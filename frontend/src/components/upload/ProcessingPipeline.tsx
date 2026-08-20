import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { ProcessingStep } from '../../types';

export interface ProcessingPipelineProps {
  steps: ProcessingStep[];
  progressPercentage: number;
}

export const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({
  steps,
  progressPercentage,
}) => {
  const hasError = steps.some((s) => s.status === 'error');

  return (
    <Card className="max-w-md mx-auto p-6 sm:p-8 flex flex-col gap-6 shadow-soft-lg border-gray-200/80 dark:border-border-dark">
      {/* Top Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="relative">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-soft-md ${
            hasError
              ? 'bg-gradient-to-tr from-red-600 to-rose-500 shadow-red-500/30'
              : 'bg-gradient-to-tr from-primary-600 to-indigo-500 shadow-primary-500/30'
          }`}>
            {hasError ? (
              <AlertCircle className="w-7 h-7 animate-bounce" />
            ) : (
              <Sparkles className="w-7 h-7 animate-pulse" />
            )}
          </div>
          {!hasError && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary-500"></span>
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
          {hasError ? 'Processing encountered an issue' : 'Processing your video in real time...'}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {hasError
            ? 'One of the pipeline stages reported an error. Please check the step below.'
            : 'Extracting live audio, transcribing speech, and synthesizing concepts with AI.'}
        </p>
      </div>

      {/* Pipeline Steps List */}
      <div className="flex flex-col gap-3 py-2">
        {steps.map((step) => {
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in_progress';
          const isError = step.status === 'error';

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                isError
                  ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20'
                  : isInProgress
                  ? 'border-primary-200/60 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-950/20'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {isError ? (
                  <div className="text-red-500 dark:text-red-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : isCompleted ? (
                  <div className="text-emerald-500 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : isInProgress ? (
                  <div className="relative flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin" />
                  </div>
                ) : (
                  <div className="text-gray-300 dark:text-gray-600 shrink-0">
                    <Circle className="w-5 h-5" />
                  </div>
                )}

                <div className="flex flex-col">
                  <span
                    className={`text-xs font-bold ${
                      isError
                        ? 'text-red-600 dark:text-red-400'
                        : isCompleted
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : isInProgress
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {step.description}
                  </span>
                </div>
              </div>

              {isInProgress && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-600 dark:bg-primary-950/80 dark:text-primary-400 animate-pulse">
                  Active
                </span>
              )}

              {isError && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300">
                  Failed
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar & Counter */}
      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-border-dark">
        <ProgressBar progress={progressPercentage} showLabel />
      </div>
    </Card>
  );
};
