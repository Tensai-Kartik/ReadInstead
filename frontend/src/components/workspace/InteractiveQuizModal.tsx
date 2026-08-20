import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Award,
  BookOpen,
  Filter,
  X,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, QuestionDifficulty } from '../../types';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BACKEND_URL } from '../../lib/config';

export interface InteractiveQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoId: string;
  questions: Question[];
}

export const InteractiveQuizModal: React.FC<InteractiveQuizModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  videoId,
  questions,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [shortAnswerInput, setShortAnswerInput] = useState<string>('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<
    { questionId: string; questionText: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; explanation: string }[]
  >([]);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [reviewIndex, setReviewIndex] = useState<number>(0);

  // Filter questions based on difficulty
  useEffect(() => {
    if (!questions || questions.length === 0) {
      setFilteredQuestions([]);
      return;
    }
    if (selectedDifficulty === 'All') {
      setFilteredQuestions(questions);
    } else {
      const filtered = questions.filter(
        (q) => q.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
      );
      setFilteredQuestions(filtered.length > 0 ? filtered : questions);
    }
    resetQuizState();
  }, [questions, selectedDifficulty]);

  const resetQuizState = () => {
    setCurrentIndex(0);
    setSelectedAnswer('');
    setShortAnswerInput('');
    setIsAnswerSubmitted(false);
    setUserAnswers([]);
    setIsQuizCompleted(false);
    setIsReviewMode(false);
    setReviewIndex(0);
  };

  if (!isOpen) return null;

  const currentQ = filteredQuestions[currentIndex];
  const totalQ = filteredQuestions.length;

  const handleSelectOption = (option: string) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(option);
  };

  const handleSubmitAnswer = () => {
    if (!currentQ) return;
    const finalUserAnswer = currentQ.question_type === 'Short Answer' || currentQ.question_type === 'Fill in the Blanks'
      ? shortAnswerInput.trim()
      : selectedAnswer;

    if (!finalUserAnswer) return;

    const isCorrect = finalUserAnswer.toLowerCase().trim() === currentQ.correct_answer.toLowerCase().trim();

    const answerRecord = {
      questionId: currentQ.id,
      questionText: currentQ.question_text,
      userAnswer: finalUserAnswer,
      correctAnswer: currentQ.correct_answer,
      isCorrect,
      explanation: currentQ.explanation,
    };

    setUserAnswers((prev) => [...prev, answerRecord]);
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < totalQ) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer('');
      setShortAnswerInput('');
      setIsAnswerSubmitted(false);
    } else {
      // Complete Quiz
      setIsQuizCompleted(true);
      const correctCount = userAnswers.filter((a) => a.isCorrect).length;
      const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

      if (accuracy >= 70) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      // Persist to backend API
      try {
        fetch(`${BACKEND_URL}/api/quiz-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            score: correctCount,
            total_questions: totalQ,
            accuracy,
            difficulty: selectedDifficulty,
            answers_json: userAnswers,
          }),
        }).catch((err) => console.log('Quiz attempt persistence note:', err));
      } catch (e) {
        // silent fallback
      }
    }
  };

  const correctAnswersCount = userAnswers.filter((a) => a.isCorrect).length;
  const accuracyPercentage = totalQ > 0 ? Math.round((correctAnswersCount / totalQ) * 100) : 0;
  const incorrectAnswers = userAnswers.filter((a) => !a.isCorrect);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-[#12151e] rounded-3xl border border-gray-200 dark:border-[#232736] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-dark bg-gray-50/50 dark:bg-card-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                Interactive Quiz Challenge
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs sm:max-w-md">
                {videoTitle}
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {!isQuizCompleted ? (
            <>
              {/* Filter pills & Progress bar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-semibold">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-primary-500" />
                    <span>Difficulty:</span>
                    {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          selectedDifficulty === diff
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-card-dark hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>

                  <span>
                    Question {currentIndex + 1} of {totalQ}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-600 to-indigo-500 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / (totalQ || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {currentQ ? (
                <div className="flex flex-col gap-5 my-auto">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{currentQ.question_type}</Badge>
                    <Badge
                      variant={
                        currentQ.difficulty === 'Easy'
                          ? 'success'
                          : currentQ.difficulty === 'Medium'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {currentQ.difficulty}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                    {currentQ.question_text}
                  </h3>

                  {/* Question Options / Input based on Type */}
                  {(currentQ.question_type === 'MCQs' || currentQ.question_type === 'True False') && (
                    <div className="grid grid-cols-1 gap-3">
                      {(currentQ.options || (currentQ.question_type === 'True False' ? ['True', 'False'] : [])).map(
                        (opt, idx) => {
                          const isSelected = selectedAnswer === opt;
                          const isCorrectOpt = opt.toLowerCase().trim() === currentQ.correct_answer.toLowerCase().trim();

                          let optionStyle =
                            'bg-gray-50 dark:bg-[#161923] border-gray-200 dark:border-[#232736] text-gray-800 dark:text-gray-200 hover:border-primary-400';

                          if (isSelected) {
                            optionStyle =
                              'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 font-semibold';
                          }

                          if (isAnswerSubmitted) {
                            if (isCorrectOpt) {
                              optionStyle =
                                'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                            } else if (isSelected && !isCorrectOpt) {
                              optionStyle =
                                'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-800 dark:text-red-300 line-through';
                            }
                          }

                          return (
                            <button
                              key={idx}
                              disabled={isAnswerSubmitted}
                              onClick={() => handleSelectOption(opt)}
                              className={`p-4 rounded-2xl border-2 text-left text-sm transition-all flex items-center justify-between ${optionStyle}`}
                            >
                              <span>{opt}</span>
                              {isAnswerSubmitted && isCorrectOpt && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                              )}
                              {isAnswerSubmitted && isSelected && !isCorrectOpt && (
                                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {(currentQ.question_type === 'Short Answer' || currentQ.question_type === 'Fill in the Blanks') && (
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        disabled={isAnswerSubmitted}
                        placeholder={
                          currentQ.question_type === 'Fill in the Blanks'
                            ? 'Type the missing word here...'
                            : 'Type your concise answer here...'
                        }
                        value={shortAnswerInput}
                        onChange={(e) => setShortAnswerInput(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-[#161923] border-2 border-gray-200 dark:border-[#232736] focus:border-primary-500 text-sm text-gray-900 dark:text-white outline-none"
                      />
                      {isAnswerSubmitted && (
                        <div className="p-3 rounded-xl bg-gray-100 dark:bg-card-dark text-xs text-gray-700 dark:text-gray-300">
                          <span className="font-bold">Expected Answer: </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {currentQ.correct_answer}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation Card */}
                  {isAnswerSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-primary-950/30 border border-indigo-100 dark:border-primary-900/50 flex items-start gap-3"
                    >
                      <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-bold text-primary-900 dark:text-primary-200">
                          Explanation & Concept Breakdown
                        </span>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {currentQ.explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-gray-500">
                  No questions found for the selected difficulty filter.
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-border-dark">
                {!isAnswerSubmitted ? (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={
                      (currentQ?.question_type === 'Short Answer' || currentQ?.question_type === 'Fill in the Blanks')
                        ? !shortAnswerInput.trim()
                        : !selectedAnswer
                    }
                    onClick={handleSubmitAnswer}
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleNextQuestion}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {currentIndex + 1 < totalQ ? 'Next Question' : 'View Final Score'}
                  </Button>
                )}
              </div>
            </>
          ) : isReviewMode ? (
            /* Review Incorrect Answers Mode */
            <div className="flex flex-col gap-5 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border-dark">
                <span className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Reviewing Missed Questions ({reviewIndex + 1} of {incorrectAnswers.length})
                </span>
                <Button variant="ghost" size="sm" onClick={() => setIsReviewMode(false)}>
                  Back to Summary
                </Button>
              </div>

              {incorrectAnswers[reviewIndex] && (
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-[#161923] border border-gray-200 dark:border-[#232736]">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {incorrectAnswers[reviewIndex].questionText}
                  </h4>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300">
                      <span className="font-bold">Your Answer: </span>
                      {incorrectAnswers[reviewIndex].userAnswer}
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                      <span className="font-bold">Correct Answer: </span>
                      {incorrectAnswers[reviewIndex].correctAnswer}
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 mt-2">
                      <span className="font-bold">Explanation: </span>
                      {incorrectAnswers[reviewIndex].explanation}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewIndex === 0}
                  onClick={() => setReviewIndex((prev) => Math.max(0, prev - 1))}
                >
                  Previous Missed
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={reviewIndex + 1 >= incorrectAnswers.length}
                  onClick={() => setReviewIndex((prev) => Math.min(incorrectAnswers.length - 1, prev + 1))}
                >
                  Next Missed
                </Button>
              </div>
            </div>
          ) : (
            /* Final Score Summary Screen */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center text-center gap-6 my-auto"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white flex items-center justify-center shadow-soft-lg">
                <Award className="w-10 h-10" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                  Quiz Completed!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Great session! Here is your performance overview.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#161923] border border-gray-200 dark:border-[#232736] flex flex-col items-center">
                  <span className="text-xs text-gray-400 font-semibold uppercase">Score</span>
                  <span className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">
                    {correctAnswersCount} / {totalQ}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#161923] border border-gray-200 dark:border-[#232736] flex flex-col items-center">
                  <span className="text-xs text-gray-400 font-semibold uppercase">Accuracy</span>
                  <span
                    className={`text-2xl font-extrabold ${
                      accuracyPercentage >= 70
                        ? 'text-emerald-500'
                        : accuracyPercentage >= 50
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  >
                    {accuracyPercentage}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                {incorrectAnswers.length > 0 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setIsReviewMode(true);
                      setReviewIndex(0);
                    }}
                    leftIcon={<Eye className="w-4 h-4" />}
                  >
                    Review Incorrect ({incorrectAnswers.length})
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  onClick={resetQuizState}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  Retry Quiz
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
