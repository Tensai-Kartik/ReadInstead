import React, { useState } from 'react';
import { Search, FileText, Save, Check, Trash2, Video } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ConfirmModal } from '../common/ConfirmModal';
import { ProcessedVideo } from '../../types';
import { cn } from '../../lib/utils';

export interface NotesManagerProps {
  videos: ProcessedVideo[];
  onUpdateNote: (videoId: string, noteContent: string) => void;
  onSelectVideo: (video: ProcessedVideo) => void;
}

export const NotesManager: React.FC<NotesManagerProps> = ({
  videos,
  onUpdateNote,
  onSelectVideo,
}) => {
  // Only show videos that have actual notes created
  const videosWithNotes = videos.filter((v) => v.personal_note && v.personal_note.trim().length > 0);

  const [selectedVideoId, setSelectedVideoId] = useState<string>(videosWithNotes[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);

  const selectedVideo = videosWithNotes.find((v) => v.id === selectedVideoId) || videosWithNotes[0];
  const [currentNote, setCurrentNote] = useState<string>(selectedVideo?.personal_note || '');

  const filteredVideos = videosWithNotes.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.personal_note && v.personal_note.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectVideo = (video: ProcessedVideo) => {
    setSelectedVideoId(video.id);
    setCurrentNote(video.personal_note || '');
    setSaveStatus(false);
  };

  const handleSave = () => {
    if (selectedVideo) {
      onUpdateNote(selectedVideo.id, currentNote);
      setSaveStatus(true);
      setTimeout(() => setSaveStatus(false), 2000);
    }
  };

  const handleDeleteNote = () => {
    if (selectedVideo) {
      onUpdateNote(selectedVideo.id, '');
      setIsDeleteConfirmOpen(false);
      const remaining = videosWithNotes.filter((v) => v.id !== selectedVideo.id);
      if (remaining.length > 0) {
        setSelectedVideoId(remaining[0].id);
        setCurrentNote(remaining[0].personal_note || '');
      } else {
        setSelectedVideoId('');
        setCurrentNote('');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Notes Workspace
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Review, edit, and manage all your custom notes linked to video lectures.
        </p>
      </div>

      {videosWithNotes.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-4 shadow-soft-sm">
          <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              No Notes Created Yet
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Personal study notes you write while reviewing video summaries will appear here for quick reference.
            </p>
          </div>
          {videos.length > 0 && (
            <Button
              size="sm"
              onClick={() => onSelectVideo(videos[0])}
              className="mt-2"
            >
              Open Study Guide & Write Notes
            </Button>
          )}
        </Card>
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Video Notes List */}
        <Card className="p-4 flex flex-col gap-4 lg:col-span-1 shadow-soft-sm">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-card-dark-hover border border-gray-200 dark:border-border-dark rounded-xl text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
            {filteredVideos.map((video) => {
              const isSelected = video.id === selectedVideoId;
              return (
                <button
                  key={video.id}
                  onClick={() => handleSelectVideo(video)}
                  className={cn(
                    'p-3.5 rounded-2xl text-left border transition-all flex flex-col gap-1.5',
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/70 border-primary-300 dark:border-primary-800'
                      : 'bg-white dark:bg-card-dark border-gray-100 dark:border-[#232736] hover:bg-gray-50 dark:hover:bg-white/5'
                  )}
                >
                  <span className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                    {video.title}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                    {video.processed_at}
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic">
                    {video.personal_note || 'No notes taken yet...'}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right Side: Note Editor */}
        {selectedVideo && (
          <Card className="p-6 flex flex-col gap-4 lg:col-span-2 shadow-soft-md">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border-dark">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedVideo.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedVideo.channel} • Processed {selectedVideo.processed_at}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectVideo(selectedVideo)}
                  leftIcon={<Video className="w-3.5 h-3.5" />}
                >
                  Open Video
                </Button>
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  title="Delete note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  leftIcon={saveStatus ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                >
                  {saveStatus ? 'Saved' : 'Save Notes'}
                </Button>
              </div>
            </div>

            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              rows={16}
              placeholder="Write your study notes here..."
              className="w-full p-4 rounded-2xl bg-gray-50/80 dark:bg-[#161923] border border-gray-200 dark:border-[#232736] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-primary-500 font-mono leading-relaxed"
            />
          </Card>
        )}
      </div>
      )}

      {/* Delete Note Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Delete Personal Study Note?"
        description="Are you sure you want to clear and delete your personal study note for this video? This action will overwrite your saved note content."
        confirmText="Yes, Delete Note"
        onConfirm={handleDeleteNote}
        onClose={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
};
