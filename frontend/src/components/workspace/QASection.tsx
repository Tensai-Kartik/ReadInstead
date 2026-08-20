import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, CheckCircle2, XCircle, Sparkles, ChevronDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card } from '../common/Card';
import { Dropdown, DropdownOption } from '../common/Dropdown';
import { Badge } from '../common/Badge';
import { Question, QuestionType, QuestionDifficulty } from '../../types';
import { cn } from '../../lib/utils';

export interface QASectionProps {
  questions: Question[];
  onStartQuiz?: () => void;
}

export const QASection: React.FC<QASectionProps> = ({ questions, onStartQuiz }) => {
  const [selectedType, setSelectedType] = useState<QuestionType>('MCQs');
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestionDifficulty>('Easy');
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  const typeOptions: DropdownOption<QuestionType>[] = [
    { value: 'MCQs', label: 'MCQs' },
    { value: 'Short Answer', label: 'Short Answer' },
    { value: 'Long Answer', label: 'Long Answer' },
    { value: 'Fill in the Blanks', label: 'Fill in the Blanks' },
    { value: 'True False', label: 'True False' },
  ];

  const difficultyOptions: DropdownOption<QuestionDifficulty>[] = [
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' },
  ];

  const filteredQuestions = questions.filter(
    (q) => q.question_type === selectedType && q.difficulty === selectedDifficulty
  );

  const handleSelectOption = (questionId: string, option: string, correctAnswer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: option }));
    setShowExplanations((prev) => ({ ...prev, [questionId]: true }));

    if (option === correctAnswer) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    }
  };

  return (
    <Card className="p-5 flex flex-col gap-5 shadow-soft-md">
      {/* Top Header & Dropdown Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Interactive Q & A Practice
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Test your mastery with adaptive AI-generated questions
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onStartQuiz && (
            <button
              onClick={onStartQuiz}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-soft-sm transition-all hover:scale-105 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Interactive Quiz</span>
            </button>
          )}

          <Dropdown<QuestionType>
            options={typeOptions}
            value={selectedType}
            onChange={setSelectedType}
            className="w-36 sm:w-40"
          />
          <Dropdown<QuestionDifficulty>
            options={difficultyOptions}
            value={selectedDifficulty}
            onChange={setSelectedDifficulty}
            className="w-28 sm:w-32"
          />
        </div>
      </div>

      {/* Questions Display */}
      {filteredQuestions.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-gray-400 dark:text-gray-500">
          <Sparkles className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-1" />
          <p className="text-sm font-semibold">No questions found for this filter combination.</p>
          <p className="text-xs">Try switching Question Type to "MCQs" or Difficulty to "Easy".</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredQuestions.map((q, qIdx) => {
            const selectedOpt = userAnswers[q.id];
            const isAnswered = !!selectedOpt;
            const isCorrect = selectedOpt === q.correct_answer;
            const isShowingExplanation = showExplanations[q.id];

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-gray-50/60 dark:bg-[#161923] border border-gray-200/70 dark:border-[#232736] flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {qIdx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                      {q.question_text}
                    </h4>
                  </div>
                  <Badge variant={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}>
                    {q.difficulty}
                  </Badge>
                </div>

                {/* Multiple Choice Options */}
                {q.question_type === 'MCQs' && q.options && (
                  <div className="grid grid-cols-1 gap-2 pl-9">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isOptionSelected = selectedOpt === opt;
                      const isThisCorrect = opt === q.correct_answer;

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(q.id, opt, q.correct_answer)}
                          className={cn(
                            'w-full flex items-center justify-between p-3 rounded-xl text-xs text-left font-medium transition-all border',
                            isAnswered
                              ? isThisCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                                : isOptionSelected
                                ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
                                : 'bg-white dark:bg-card-dark border-gray-200 dark:border-[#232736] text-gray-500 opacity-60'
                              : 'bg-white dark:bg-card-dark border-gray-200 dark:border-[#232736] text-gray-800 dark:text-gray-200 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/30'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 flex items-center justify-center font-bold text-[11px]">
                              {letter}
                            </span>
                            <span>{opt}</span>
                          </div>

                          {isAnswered && (
                            <span>
                              {isThisCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : isOptionSelected ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : null}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Short / Long / True-False or Fill Blanks */}
                {q.question_type !== 'MCQs' && (
                  <div className="pl-9 flex flex-col gap-3">
                    <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-white dark:bg-card-dark p-3 rounded-xl border border-gray-200 dark:border-[#232736]">
                      Answer: <span className="font-semibold not-italic">{q.correct_answer}</span>
                    </p>
                  </div>
                )}

                {/* Explanation Reveal */}
                {isShowingExplanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="ml-9 p-3.5 rounded-xl bg-indigo-50/60 dark:bg-primary-950/40 border border-indigo-200/60 dark:border-primary-800/40 text-xs text-indigo-950 dark:text-indigo-200 flex flex-col gap-1"
                  >
                    <span className="font-bold flex items-center gap-1 text-primary-700 dark:text-primary-300">
                      <Sparkles className="w-3.5 h-3.5" /> Explanation & Concept Insight
                    </span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
