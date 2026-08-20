import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { StatsOverview } from './components/dashboard/StatsOverview';
import { StudyBarChart } from './components/dashboard/StudyBarChart';
import { TrendLineChart } from './components/dashboard/TrendLineChart';
import { RecentVideosGrid } from './components/dashboard/RecentVideosGrid';
import { UploadCard } from './components/upload/UploadCard';
import { ProcessingPipeline } from './components/upload/ProcessingPipeline';
import { VideoPlayer } from './components/workspace/VideoPlayer';
import { SummaryTab } from './components/workspace/SummaryTab';
import { QASection } from './components/workspace/QASection';
import { FlashcardsSection } from './components/workspace/FlashcardsSection';
import { PersonalNotesSection } from './components/workspace/PersonalNotesSection';
import { AIChatAssistant } from './components/workspace/AIChatAssistant';
import { InteractiveQuizModal } from './components/workspace/InteractiveQuizModal';
import { ExportModal } from './components/workspace/ExportModal';
import { LanguageSelector } from './components/workspace/LanguageSelector';
import { HistoryGrid } from './components/history/HistoryGrid';
import { NotesManager } from './components/notes/NotesManager';
import { SettingsView } from './components/settings/SettingsView';
import { LoginPage } from './components/auth/LoginPage';
import { AuthModal } from './components/auth/AuthModal';
import { BackendConfigModal } from './components/common/BackendConfigModal';

import { ProcessedVideo, ProcessingStep, NavTab, LanguageCode, SummaryContent } from './types';
import {
  processVideoPipeline,
  INITIAL_PROCESSING_STEPS,
  fetchUserHistory,
  deleteVideoFromHistory,
  savePersonalNote,
} from './services/aiService';
import { ArrowLeft, Download, Sparkles, PlusCircle } from 'lucide-react';
import { Button } from './components/common/Button';

function formatCleanTitle(title: string): string {
  if (!title) return 'Educational Masterclass';
  const cleaned = title.replace(/\s*\([a-zA-Z0-9_-]{6,}\)/g, '').trim();
  if (cleaned.toLowerCase() === 'educational video' || !cleaned) {
    return 'Educational Masterclass';
  }
  return cleaned;
}

const MainAppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [videos, setVideos] = useState<ProcessedVideo[]>(() => {
    try {
      const saved = localStorage.getItem('readinstead_saved_videos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [selectedVideo, setSelectedVideo] = useState<ProcessedVideo | null>(() => {
    try {
      const saved = localStorage.getItem('readinstead_saved_videos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch {}
    return null;
  });

  // Upload & Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(INITIAL_PROCESSING_STEPS);
  const [processingPercentage, setProcessingPercentage] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals & Multilingual state
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');

  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Load latest videos from Supabase on mount and when user auth changes
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        const dbVideos = await fetchUserHistory(user?.id);
        if (isMounted && dbVideos && dbVideos.length > 0) {
          setVideos(dbVideos);
          try {
            localStorage.setItem('readinstead_saved_videos', JSON.stringify(dbVideos));
          } catch {}

          // Update selected video with fresh title and channel from database
          setSelectedVideo((prev) => {
            if (prev) {
              const matched = dbVideos.find((v) => v.id === prev.id || v.youtube_url === prev.youtube_url);
              if (matched) return matched;
            }
            return dbVideos[0];
          });
        }
      } catch (err) {
        console.warn('Failed to load history from database:', err);
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Always scroll to top of workspace on tab switch or video change
  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [selectedVideo?.id, activeTab, isUploadingNew]);

  // Restore active video & tab from localStorage on refresh / initial mount
  useEffect(() => {
    try {
      const savedVidId = localStorage.getItem('readinstead_active_video_id');
      const savedTab = localStorage.getItem('readinstead_active_tab') as NavTab | null;
      if (savedVidId) {
        const found = videos.find((v) => v.id === savedVidId);
        if (found) {
          setSelectedVideo(found);
        }
      }
      if (savedTab && savedTab !== 'dashboard') {
        setActiveTab(savedTab);
      } else if (savedVidId) {
        setActiveTab('new_video');
      }
    } catch (e) {
      console.error('Error loading active state from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    if (selectedVideo?.id) {
      localStorage.setItem('readinstead_active_video_id', selectedVideo.id);
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('readinstead_active_tab', activeTab);
    }
  }, [activeTab]);

  // GATEWAY CHECK: First show full-screen LoginPage if unauthenticated
  if (isLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-gray-500 text-sm">
        Loading ReadInstead Workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleSelectVideo = (video: ProcessedVideo) => {
    const orig = video.original_summary || video.summary;
    const currentTranslated = video.translations?.[currentLanguage] || (currentLanguage === 'en' ? orig : video.summary);
    setSelectedVideo({
      ...video,
      original_summary: orig,
      summary: currentTranslated,
    });
    setIsUploadingNew(false);
    setActiveTab('new_video');
  };

  const handleStartProcessing = async (urlOrFile: string | File) => {
    setIsProcessing(true);
    setProcessingPercentage(0);
    setProcessingSteps(JSON.parse(JSON.stringify(INITIAL_PROCESSING_STEPS)));
    setProcessingError(null);

    try {
      const newVideo = await processVideoPipeline(urlOrFile, (steps, percentage) => {
        setProcessingSteps(steps);
        setProcessingPercentage(percentage);
      });

      const videoWithOrig = {
        ...newVideo,
        original_summary: newVideo.summary,
      };

      setVideos((prev) => {
        const updated = [videoWithOrig, ...prev.filter((v) => v.id !== videoWithOrig.id)];
        try {
          localStorage.setItem('readinstead_saved_videos', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setSelectedVideo(videoWithOrig);
      setIsUploadingNew(false);
      setIsProcessing(false);
      setActiveTab('new_video');
    } catch (err: any) {
      console.error('Video processing failed:', err);
      setProcessingError(err.message || 'An error occurred while processing the video.');
    }
  };

  const handleSavePersonalNote = (noteText: string) => {
    if (selectedVideo) {
      const updatedVideo = { ...selectedVideo, personal_note: noteText };
      setSelectedVideo(updatedVideo);
      setVideos((prev) => {
        const updated = prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v));
        try {
          localStorage.setItem('readinstead_saved_videos', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      savePersonalNote(selectedVideo.id, noteText, user?.id).catch((e) => console.warn('Note save error:', e));
    }
  };

  const handleUpdateNote = (videoId: string, noteContent: string) => {
    setVideos((prev) => {
      const updated = prev.map((v) => (v.id === videoId ? { ...v, personal_note: noteContent } : v));
      try {
        localStorage.setItem('readinstead_saved_videos', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    savePersonalNote(videoId, noteContent, user?.id).catch((e) => console.warn('Note update error:', e));
  };

  const handleDeleteVideo = (videoId: string) => {
    deleteVideoFromHistory(videoId).catch((e) => console.warn('Delete video error:', e));
    setVideos((prev) => {
      const updated = prev.filter((v) => v.id !== videoId);
      try {
        localStorage.setItem('readinstead_saved_videos', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (selectedVideo?.id === videoId) {
      setSelectedVideo((prev) => videos.find((v) => v.id !== videoId) || null);
    }
  };

  const handleLanguageChanged = (newLang: LanguageCode, translatedSummary: SummaryContent) => {
    setCurrentLanguage(newLang);
    if (selectedVideo) {
      const orig = selectedVideo.original_summary || selectedVideo.summary;
      const translations = { ...(selectedVideo.translations || {}), [newLang]: translatedSummary };
      const updated: ProcessedVideo = {
        ...selectedVideo,
        original_summary: orig,
        translations,
        summary: translatedSummary,
      };
      setSelectedVideo(updated);
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasActiveVideo={!!selectedVideo}
          onOpenBackendModal={() => setIsBackendModalOpen(true)}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasActiveVideo={!!selectedVideo}
              isMobileOpen={isMobileSidebarOpen}
              setIsMobileOpen={setIsMobileSidebarOpen}
              onOpenBackendModal={() => setIsBackendModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopHeader
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenBackendModal={() => setIsBackendModalOpen(true)}
        />

        <main ref={mainContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {/* 1. DASHBOARD VIEW */}
            {activeTab === 'dashboard' && (
              <>
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {user?.full_name?.trim()
                      ? `Welcome back, ${user.full_name.trim()}! Here is your video summary dashboard and time saved metrics.`
                      : 'Welcome back! Here is your video summary dashboard and time saved metrics.'}
                  </p>
                </div>

                <StatsOverview videos={videos} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StudyBarChart videos={videos} />
                  <TrendLineChart videos={videos} />
                </div>

                <RecentVideosGrid
                  videos={videos}
                  onSelectVideo={handleSelectVideo}
                  onNewVideoClick={() => {
                    setIsUploadingNew(true);
                    setActiveTab('new_video');
                  }}
                />
              </>
            )}

            {/* 2. UPLOAD & VIDEO SUMMARY WORKSPACE VIEW */}
            {(activeTab === 'new_video' || (activeTab as any) === 'workspace') && (
              <div className="flex flex-col gap-6">
                {isProcessing ? (
                  <div className="py-6 flex flex-col items-center gap-4">
                    <ProcessingPipeline
                      steps={processingSteps}
                      progressPercentage={processingPercentage}
                    />
                    {processingError && (
                      <div className="max-w-md w-full p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                          {processingError}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsProcessing(false);
                            setProcessingError(null);
                            setIsUploadingNew(true);
                          }}
                          className="shrink-0 text-xs"
                        >
                          Try Again
                        </Button>
                      </div>
                    )}
                  </div>
                ) : selectedVideo && !isUploadingNew ? (
                  /* SUMMARY WORKSPACE VIEW */
                  <div className="flex flex-col gap-6">
                    {/* Clean Workspace Header Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-card-dark border border-gray-200/80 dark:border-border-dark shadow-soft-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setIsUploadingNew(true);
                            setActiveTab('new_video');
                          }}
                          leftIcon={<PlusCircle className="w-4 h-4" />}
                        >
                          Summarize Another Video
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('history')}
                          leftIcon={<ArrowLeft className="w-4 h-4" />}
                        >
                          Back to History
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <LanguageSelector
                          videoId={selectedVideo.id}
                          currentLanguage={currentLanguage}
                          summaryData={selectedVideo.summary}
                          originalSummary={selectedVideo.original_summary || selectedVideo.summary}
                          onLanguageChanged={handleLanguageChanged}
                        />

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsExportModalOpen(true)}
                          leftIcon={<Download className="w-3.5 h-3.5 text-emerald-500" />}
                        >
                          Export Study Guide
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setIsQuizModalOpen(true)}
                          leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                        >
                          Take Interactive Quiz
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 flex flex-col">
                        <VideoPlayer
                          video={selectedVideo}
                          seekTimeSeconds={seekTime}
                        />
                      </div>

                      <div className="lg:col-span-5 flex flex-col h-full">
                        <SummaryTab
                          summary={selectedVideo.summary}
                          onSeekTimestamp={(sec) => setSeekTime(sec)}
                        />
                      </div>
                    </div>

                    <AIChatAssistant
                      videoId={selectedVideo.id}
                      videoTitle={selectedVideo.title}
                      contextSummary={selectedVideo.summary}
                      onSeekTimestamp={(sec) => setSeekTime(sec)}
                    />

                    <QASection
                      questions={selectedVideo.questions}
                      onStartQuiz={() => setIsQuizModalOpen(true)}
                    />

                    <FlashcardsSection flashcards={selectedVideo.flashcards} />

                    <PersonalNotesSection
                      initialNote={selectedVideo.personal_note || ''}
                      onSaveNote={handleSavePersonalNote}
                    />

                    <InteractiveQuizModal
                      isOpen={isQuizModalOpen}
                      onClose={() => setIsQuizModalOpen(false)}
                      videoTitle={selectedVideo.title}
                      videoId={selectedVideo.id}
                      questions={selectedVideo.questions}
                    />

                    <ExportModal
                      isOpen={isExportModalOpen}
                      onClose={() => setIsExportModalOpen(false)}
                      video={selectedVideo}
                    />
                  </div>
                ) : (
                  /* UPLOAD CARD VIEW */
                  <div className="py-6 flex flex-col gap-4">
                    {selectedVideo && (
                      <div className="flex justify-start max-w-2xl mx-auto w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsUploadingNew(false);
                            setActiveTab('new_video');
                          }}
                          leftIcon={<ArrowLeft className="w-4 h-4" />}
                        >
                          Return to Current Video Summary
                        </Button>
                      </div>
                    )}
                    <UploadCard
                      onStartProcessing={handleStartProcessing}
                      onOpenBackendModal={() => setIsBackendModalOpen(true)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 4. HISTORY VIEW */}
            {activeTab === 'history' && (
              <HistoryGrid
                videos={videos}
                onSelectVideo={handleSelectVideo}
                onDeleteVideo={handleDeleteVideo}
                onNewVideoClick={() => {
                  setIsUploadingNew(true);
                  setActiveTab('new_video');
                }}
              />
            )}

            {/* 5. NOTES VIEW */}
            {activeTab === 'notes' && (
              <NotesManager
                videos={videos}
                onUpdateNote={handleUpdateNote}
                onSelectVideo={handleSelectVideo}
              />
            )}

            {/* 6. SETTINGS VIEW */}
            {activeTab === 'settings' && (
              <SettingsView onOpenBackendModal={() => setIsBackendModalOpen(true)} />
            )}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <AuthModal />
      {isAdmin && (
        <BackendConfigModal
          isOpen={isBackendModalOpen}
          onClose={() => setIsBackendModalOpen(false)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
