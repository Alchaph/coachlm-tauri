import { useRef, useEffect } from "react";
import { MessageSquare, Square, RefreshCw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrentStepLabel } from "@/components/chat/ChatProgress";
import ChatMessage from "@/components/chat/ChatMessage";
import OllamaSetupGuide from "@/components/OllamaSetupGuide";
import type { Message, ProgressStep } from "@/components/chat/types";

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  error: string | null;
  progressSteps: ProgressStep[];
  completedSteps: ProgressStep[] | null;
  editingMessageId: number | null;
  editContent: string;
  ollamaOffline: boolean;
  ollamaEndpoint: string;
  activeLlm: string;
  showSetupGuide: boolean;
  onEditContentChange: (value: string) => void;
  onStartEditing: (msg: Message) => void;
  onCancelEditing: () => void;
  onSubmitEdit: () => void;
  onCopyMessage: (content: string) => void;
  onPinMessage: (content: string) => void;
  onSetInput: (value: string) => void;
  onStopGenerating: () => void;
  onToggleSetupGuide: () => void;
  onRetry: () => void;
  onOllamaConnected: () => void;
}

export default function ChatMessageList({
  messages,
  loading,
  error,
  progressSteps,
  completedSteps,
  editingMessageId,
  editContent,
  ollamaOffline,
  ollamaEndpoint,
  activeLlm,
  showSetupGuide,
  onEditContentChange,
  onStartEditing,
  onCancelEditing,
  onSubmitEdit,
  onCopyMessage,
  onPinMessage,
  onSetInput,
  onStopGenerating,
  onToggleSetupGuide,
  onRetry,
  onOllamaConnected,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    shouldAutoScrollRef.current = atBottom;
  };

  return (
    <div
      className="flex-1 overflow-auto p-5"
      onScroll={handleScroll}
    >
      {messages.length === 0 && !loading && (
        <div className="text-center py-12 px-6 text-muted-foreground/60">
          {ollamaOffline && (activeLlm === "ollama" || activeLlm === "local" || !activeLlm) ? (
            <div className="max-w-[480px] mx-auto text-left">
              <OllamaSetupGuide
                endpoint={ollamaEndpoint}
                onConnected={onOllamaConnected}
              />
            </div>
          ) : (
            <>
              <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
              <p>Start a conversation with your AI running coach.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {["Review my last week of training", "Help me plan a tempo run", "What should my easy pace be?"].map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => { onSetInput(prompt); }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] mt-3 text-muted-foreground/60">
                Tip: Be specific with running terms for best results. LLMs can misinterpret ambiguous phrases.
              </p>
            </>
          )}
        </div>
      )}

      {messages.map((msg, msgIndex) => {
        const isLastAssistant = msg.role === "assistant" && msgIndex === messages.length - 1;
        return (
          <ChatMessage
            key={msg.id}
            msg={msg}
            isLastAssistant={isLastAssistant}
            loading={loading}
            progressSteps={progressSteps}
            completedSteps={completedSteps}
            editingMessageId={editingMessageId}
            editContent={editContent}
            onEditContentChange={onEditContentChange}
            onStartEditing={onStartEditing}
            onCancelEditing={onCancelEditing}
            onSubmitEdit={onSubmitEdit}
            onCopyMessage={onCopyMessage}
            onPinMessage={onPinMessage}
          />
        );
      })}

      {loading && !messages.some((m) => m.id === -1) && (
        <div className="flex flex-col items-start mb-4">
          {progressSteps.length > 0 ? (
            <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} startedAt={progressSteps[progressSteps.length - 1].startedAt} />
          ) : (
            <div className="text-[11px] text-muted-foreground/60">
              Thinking...
            </div>
          )}
        </div>
      )}

      {loading && messages.some((m) => m.id === -1) && (
        <div className="flex justify-center mb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onStopGenerating}
            className="flex items-center gap-1.5"
          >
            <Square size={12} /> Stop generating
          </Button>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <div className="text-left px-4 py-2.5 rounded-md bg-card border border-destructive flex items-center justify-between gap-3">
            <span>{error}</span>
            <div className="flex items-center gap-1 shrink-0">
              {error.includes("Ollama is not running") && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onToggleSetupGuide}
                  aria-label="Setup guide"
                  className="flex items-center gap-1 text-muted-foreground"
                >
                  <HelpCircle size={14} /> Setup Guide
                </Button>
              )}
              {!loading && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onRetry}
                  aria-label="Retry"
                  className="flex items-center gap-1 text-destructive"
                >
                  <RefreshCw size={14} /> Retry
                </Button>
              )}
            </div>
          </div>
          {showSetupGuide && (
            <div className="px-4 py-3 rounded-md bg-card border border-border">
              <OllamaSetupGuide
                endpoint={ollamaEndpoint}
                compact
                onConnected={onOllamaConnected}
              />
            </div>
          )}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
