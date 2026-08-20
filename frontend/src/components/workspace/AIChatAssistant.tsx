import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Play,
  Bot,
  User,
  Zap,
  Copy,
  Check,
  Trash2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { RAGChatMessage, SummaryContent } from '../../types';
import { sendChatMessage, fetchChatHistory } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export interface AIChatAssistantProps {
  videoId: string;
  videoTitle: string;
  contextSummary?: SummaryContent;
  onSeekTimestamp?: (seconds: number) => void;
}

const PREDEFINED_PROMPTS = [
  { icon: '💡', text: 'Explain this topic simply.' },
  { icon: '🎯', text: 'What did the speaker say about the core concept?' },
  { icon: '🏗️', text: 'Summarize the key architectural points.' },
  { icon: '⚡', text: 'Compare the trade-offs mentioned in the video.' },
  { icon: '🔍', text: 'What are the most important terms and definitions?' },
  { icon: '📊', text: 'What are the main conclusions and takeaways?' },
];

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  videoId,
  videoTitle,
  contextSummary,
  onSeekTimestamp,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RAGChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPromptSuggestionsVisible, setIsPromptSuggestionsVisible] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history or set initial greeting when video changes
  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      setIsLoading(true);
      try {
        const history = await fetchChatHistory(videoId, user?.id);
        if (isMounted) {
          if (history && history.length > 0) {
            setMessages(history);
          } else {
            // Default initial welcoming message
            setMessages([
              {
                id: `welcome_${videoId}`,
                sender: 'assistant',
                content: `👋 **Welcome to your AI Study Companion!**\n\nI'm ready to answer any questions about **"${videoTitle}"**. Ask for concept breakdowns, detailed explanations, or choose from the suggested questions below.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }
      } catch {
        if (isMounted) {
          setMessages([
            {
              id: `welcome_${videoId}`,
              sender: 'assistant',
              content: `👋 **Welcome!** Ask me anything about **"${videoTitle}"**. I'll provide clear answers linked to key video moments.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [videoId, videoTitle]);

  // Scroll internal chat container to bottom when messages update (without scrolling the outer window/page)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputValue.trim();
    if (!textToSend || isLoading) return;

    const userMessage: RAGChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Build context hint from summary if available
    let contextHint = '';
    if (contextSummary) {
      const notes = (contextSummary.detailed_notes || []).join(' ');
      const takeaways = (contextSummary.key_takeaways || []).join(' ');
      const concepts = (contextSummary.important_concepts || [])
        .map((c) => `${c.term}: ${c.definition}`)
        .join('; ');
      contextHint = `${contextSummary.executive_summary || ''} ${contextSummary.tldr || ''} ${notes} ${takeaways} ${concepts}`;
    }

    try {
      const result = await sendChatMessage(
        videoId,
        textToSend,
        videoTitle,
        contextHint,
        user?.id
      );

      const assistantMessage: RAGChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        content: result.answer,
        sources: result.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: RAGChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'assistant',
        content: `I encountered an issue querying the video transcript. Please try asking your question again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${videoId}_${Date.now()}`,
        sender: 'assistant',
        content: `Chat history cleared. What would you like to explore regarding **"${videoTitle}"**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Convert seconds from "MM:SS" or numbers
  const parseTimeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // Render markdown text with interactive timestamp buttons
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, lineIdx) => {
      if (!line.trim()) {
        return <div key={lineIdx} className="h-2" />;
      }

      // Check for bullet list item
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const isNumbered = /^\d+\.\s/.test(line.trim());
      const cleanLine = isBullet ? line.trim().replace(/^[-*]\s/, '') : line;

      // Split line to find [MM:SS] timestamps and **bold** text
      const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = timestampRegex.exec(cleanLine)) !== null) {
        const preMatch = cleanLine.substring(lastIndex, match.index);
        if (preMatch) {
          parts.push(renderBoldInline(preMatch, `${lineIdx}_pre_${lastIndex}`));
        }

        const timeStr = match[1];
        const seconds = parseTimeToSeconds(timeStr);

        parts.push(
          <button
            key={`${lineIdx}_ts_${match.index}`}
            onClick={() => onSeekTimestamp && onSeekTimestamp(seconds)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-primary-100/80 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 font-mono text-[11px] font-bold border border-primary-300/60 dark:border-primary-700/50 transition-all hover:scale-105 active:scale-95"
            title={`Seek video to ${timeStr}`}
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            <span>{timeStr}</span>
          </button>
        );

        lastIndex = match.index + match[0].length;
      }

      const remainder = cleanLine.substring(lastIndex);
      if (remainder) {
        parts.push(renderBoldInline(remainder, `${lineIdx}_rem_${lastIndex}`));
      }

      if (isBullet) {
        return (
          <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 shrink-0" />
            <div className="leading-relaxed">{parts}</div>
          </div>
        );
      }

      if (isNumbered) {
        return (
          <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
            <div className="leading-relaxed">{parts}</div>
          </div>
        );
      }

      return (
        <p key={lineIdx} className="leading-relaxed my-1">
          {parts}
        </p>
      );
    });
  };

  const renderBoldInline = (text: string, keyPrefix: string): React.ReactNode => {
    const boldParts = text.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}_${pIdx}`} className="font-bold text-gray-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${keyPrefix}_${pIdx}`}>{part}</span>;
    });
  };

  return (
    <Card className="p-5 flex flex-col gap-4 shadow-soft-md border-gray-200/80 dark:border-border-dark overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-border-dark">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-soft-sm shadow-primary-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
            AI Study Assistant
          </h3>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsPromptSuggestionsVisible(!isPromptSuggestionsVisible)}
            className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors flex items-center gap-1"
            title="Toggle prompt suggestions"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span className="hidden sm:inline">Suggestions</span>
            {isPromptSuggestionsVisible ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
            title="Clear chat conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-gray-100 dark:bg-card-dark-hover hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
            title={isExpanded ? 'Minimize chat height' : 'Expand chat height'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Predefined Quick Prompts Carousel */}
      <AnimatePresence>
        {isPromptSuggestionsVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary-500" /> Suggestions:
            </span>
            {PREDEFINED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.text)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-[#161923] hover:bg-primary-50 dark:hover:bg-primary-950/60 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200/60 dark:border-[#232736] hover:border-primary-300 dark:hover:border-primary-700/60 text-xs font-medium text-gray-700 dark:text-gray-300 transition-all active:scale-95 disabled:opacity-50"
              >
                <span>{prompt.icon}</span>
                <span>{prompt.text}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages Viewport */}
      <div
        ref={chatContainerRef}
        className={cn(
          'flex flex-col gap-4 overflow-y-auto pr-1 transition-all duration-200 p-2 rounded-2xl bg-gray-50/50 dark:bg-[#0f1118] border border-gray-100 dark:border-[#1e2230]',
          isExpanded ? 'h-[550px]' : 'h-[360px]'
        )}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isCopied = copiedId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-soft-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[85%] sm:max-w-[78%] flex flex-col gap-2 rounded-2xl p-4 text-xs sm:text-sm',
                    isUser
                      ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-soft-md rounded-br-sm'
                      : 'bg-white dark:bg-[#161923] text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-[#232736] shadow-soft-sm rounded-bl-sm'
                  )}
                >
                  {/* Sender Header */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-black/5 dark:border-white/5">
                    <span className={cn('font-bold text-[11px]', isUser ? 'text-primary-100' : 'text-primary-600 dark:text-primary-400')}>
                      {isUser ? 'You' : 'ReadInstead AI'}
                    </span>
                    <span className={cn('text-[10px]', isUser ? 'text-primary-200' : 'text-gray-400')}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="prose-sm dark:prose-invert leading-relaxed">
                    {renderFormattedContent(msg.content)}
                  </div>

                  {/* Grounded Sources & Citations if provided */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-border-dark flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-primary-500" /> Key Timestamps:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, srcIdx) => {
                          const seekSec = src.start_seconds !== undefined ? src.start_seconds : (src.seconds !== undefined ? src.seconds : 0);
                          const timeDisplay = src.timestamp || src.time || '00:00';
                          return (
                            <button
                              key={srcIdx}
                              onClick={() => onSeekTimestamp && onSeekTimestamp(seekSec)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#1e2230] hover:bg-primary-50 dark:hover:bg-primary-950/60 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200/60 dark:border-[#2b3042] text-[11px] font-medium transition-all group"
                              title={src.snippet}
                            >
                              <Play className="w-2.5 h-2.5 fill-current text-primary-500 group-hover:scale-110 transition-transform" />
                              <span className="font-mono font-bold text-primary-600 dark:text-primary-400">[{timeDisplay}]</span>
                              <span className="truncate max-w-[140px] text-[10px] text-gray-500 dark:text-gray-400">
                                {src.snippet.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/, '')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions (Copy / Retry) */}
                  {!isUser && (
                    <div className="flex items-center justify-end gap-1.5 pt-1 mt-1 text-[11px] text-gray-400">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title="Copy answer to clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-card-dark text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0 mt-1 shadow-soft-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#161923] border border-gray-200/80 dark:border-[#232736] flex items-center gap-3 shadow-soft-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Generating concise, grounded answer...
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Chat Input Bar */}
      <div className="flex flex-col gap-2">
        <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-white dark:bg-[#161923] border border-gray-200 dark:border-[#232736] focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 shadow-soft-sm transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this video (e.g. 'What are the main key takeaways?')..."
            className="flex-1 max-h-32 min-h-[38px] p-2 bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
          />

          <Button
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            leftIcon={<Send className="w-3.5 h-3.5" />}
            className="shrink-0 h-9 px-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold shadow-soft-sm whitespace-nowrap"
          >
            Ask AI
          </Button>
        </div>
      </div>
    </Card>
  );
};
