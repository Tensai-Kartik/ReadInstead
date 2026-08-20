import React, { useState, useEffect } from 'react';
import { FileEdit, Check, Save } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

export interface PersonalNotesSectionProps {
  initialNote?: string;
  onSaveNote: (note: string) => void;
}

export const PersonalNotesSection: React.FC<PersonalNotesSectionProps> = ({
  initialNote = '',
  onSaveNote,
}) => {
  const [noteContent, setNoteContent] = useState(initialNote);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setNoteContent(initialNote);
  }, [initialNote]);

  // Auto save debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (noteContent !== initialNote) {
        setSaveStatus('saving');
        onSaveNote(noteContent);
        setTimeout(() => setSaveStatus('saved'), 400);
        setTimeout(() => setSaveStatus('idle'), 2500);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [noteContent]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    onSaveNote(noteContent);
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <Card className="p-5 flex flex-col gap-4 shadow-soft-md">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              My Personal Study Notes
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Auto-saves directly to your cloud profile history
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">
            {saveStatus === 'saving' && 'Auto-saving...'}
            {saveStatus === 'saved' && (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved Note
              </span>
            )}
          </span>

          <Button
            size="sm"
            onClick={handleManualSave}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Note
          </Button>
        </div>
      </div>

      <textarea
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        placeholder="Add your personal notes, insights, or formulas for this video..."
        rows={5}
        className="w-full p-4 rounded-2xl bg-gray-50/70 dark:bg-[#161923] border border-gray-200 dark:border-[#232736] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 font-mono leading-relaxed"
      />
    </Card>
  );
};
