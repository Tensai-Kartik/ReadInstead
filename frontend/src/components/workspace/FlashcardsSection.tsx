import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Shuffle,
  RotateCcw,
  Check,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Flashcard } from '../../types';

export interface FlashcardsSectionProps {
  flashcards: Flashcard[];
}

export const FlashcardsSection: React.FC<FlashcardsSectionProps> = ({ flashcards: initialCards }) => {
  const [cards, setCards] = useState<Flashcard[]>(initialCards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCards(initialCards || []);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [initialCards]);

  if (!cards || cards.length === 0) {
    return null;
  }

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMarkKnown = () => {
    if (!currentCard) return;
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleMarkReview = () => {
    if (!currentCard) return;
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
  };

  const handleRestart = () => {
    setIsFlipped(false);
    setCards(initialCards || []);
    setCurrentIndex(0);
    setMasteredIds(new Set());
    setReviewIds(new Set());
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent key listeners when user is typing in inputs or textareas
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'k' || e.key === 'K') {
        handleMarkKnown();
      } else if (e.key === 'r' || e.key === 'R') {
        handleMarkReview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, cards.length, currentCard?.id]);

  const masteredCount = masteredIds.size;
  const reviewCount = reviewIds.size;

  return (
    <Card className="p-5 flex flex-col gap-5 shadow-soft-md">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border-dark">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Flashcard Practice
            </h3>
          </div>
        </div>

        {/* Action Controls & Progress Badges */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <Badge variant="success" className="shrink-0">
            Known: {masteredCount}
          </Badge>
          <Badge variant="warning" className="shrink-0">
            Review: {reviewCount}
          </Badge>
          <button
            onClick={handleShuffle}
            title="Shuffle cards"
            className="p-2 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={handleRestart}
            title="Restart session"
            className="p-2 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Badge variant="primary" className="shrink-0">
            Card {currentIndex + 1} of {cards.length}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* 3D Flip Card Container */}
      <div className="w-full h-64 sm:h-72 perspective-1000">
        <motion.div
          onClick={handleFlip}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="w-full h-full relative transform-style-3d cursor-pointer select-none"
        >
          {/* FRONT OF CARD */}
          <div className="absolute inset-0 backface-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white to-indigo-50/50 dark:from-[#161923] dark:to-primary-950/20 border-2 border-indigo-100 dark:border-primary-900/50 shadow-soft-lg flex flex-col justify-between items-center text-center">
            <div className="w-full flex justify-between items-center text-xs text-gray-400">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-primary-600 dark:text-primary-400">
                <Sparkles className="w-3.5 h-3.5" /> Concept Prompt
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <RotateCw className="w-3 h-3" /> Flip
              </span>
            </div>

            <p className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white max-w-lg leading-relaxed">
              {currentCard.front}
            </p>

            <div className="flex items-center gap-2">
              {masteredIds.has(currentCard.id) && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-0.5 rounded-full border border-emerald-200">
                  ✓ Marked as Known
                </span>
              )}
              {reviewIds.has(currentCard.id) && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-0.5 rounded-full border border-amber-200">
                  ⚡ Marked for Review
                </span>
              )}
            </div>
          </div>

          {/* BACK OF CARD */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-primary-900 via-indigo-950 to-purple-950 text-white border-2 border-primary-600/50 shadow-soft-lg flex flex-col justify-between items-center text-center">
            <div className="w-full flex justify-between items-center text-xs text-indigo-300">
              <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Core Answer & Concept
              </span>
              <span className="flex items-center gap-1 text-[11px] text-indigo-300">
                <RotateCw className="w-3 h-3" /> Flip
              </span>
            </div>

            <p className="text-sm sm:text-base font-semibold text-indigo-50 leading-relaxed max-w-lg">
              {currentCard.back}
            </p>

            <div className="h-2" />
          </div>
        </motion.div>
      </div>

      {/* Navigation & Mastery Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <Button
            variant="outline"
            size="md"
            onClick={handlePrev}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlip}
            leftIcon={<RotateCw className="w-4 h-4" />}
          >
            Flip Card
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next
          </Button>
        </div>

        {/* Known / Review Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <button
            onClick={handleMarkReview}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need Review</span>
          </button>
          <button
            onClick={handleMarkKnown}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Got It!</span>
          </button>
        </div>
      </div>
    </Card>
  );
};
