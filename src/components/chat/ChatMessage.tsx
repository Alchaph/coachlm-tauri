import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Pin, Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CurrentStepLabel, CollapsedStepsSummary } from "@/components/chat/ChatProgress";
import type { Message, ProgressStep } from "@/components/chat/types";

interface ChatMessageProps {
  msg: Message;
  isLastAssistant: boolean;
  loading: boolean;
  progressSteps: ProgressStep[];
  completedSteps: ProgressStep[] | null;
  editingMessageId: number | null;
  editContent: string;
  onEditContentChange: (value: string) => void;
  onStartEditing: (msg: Message) => void;
  onCancelEditing: () => void;
  onSubmitEdit: () => void;
  onCopyMessage: (content: string) => void;
  onPinMessage: (content: string) => void;
}

export default function ChatMessage({
  msg,
  isLastAssistant,
  loading,
  progressSteps,
  completedSteps,
  editingMessageId,
  editContent,
  onEditContentChange,
  onStartEditing,
  onCancelEditing,
  onSubmitEdit,
  onCopyMessage,
  onPinMessage,
}: ChatMessageProps) {
  const isStreaming = msg.id === -1;
  const showActiveStepper = isStreaming && loading && progressSteps.length > 0;
  const showThinkingLabel = isStreaming && loading && progressSteps.length === 0;
  const showCollapsedSummary = isLastAssistant && !isStreaming && !loading && completedSteps !== null && completedSteps.length > 0;

  return (
    <div
      className={cn(
        "mb-4 flex flex-col",
        msg.role === "user" ? "items-end" : "items-start"
      )}
    >
      {showActiveStepper && (
        <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} startedAt={progressSteps[progressSteps.length - 1].startedAt} />
      )}
      {showThinkingLabel && (
        <div className="text-[11px] text-muted-foreground/60 mb-1">
          Thinking...
        </div>
      )}
      {showCollapsedSummary && (
        <CollapsedStepsSummary steps={completedSteps} />
      )}
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-md",
          msg.role === "user"
            ? "chat-message-user bg-[var(--accent-dim)]"
            : "bg-card border border-border"
        )}
      >
        {msg.role === "assistant" ? (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ) : editingMessageId === msg.id ? (
          <div className="flex flex-col gap-2 min-w-[300px]">
            <Textarea
              value={editContent}
              onChange={(e) => { onEditContentChange(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmitEdit();
                }
                if (e.key === "Escape") {
                  onCancelEditing();
                }
              }}
              rows={3}
              className="resize-y leading-5 bg-secondary border-primary"
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEditing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSubmitEdit}
                disabled={!editContent.trim() || loading}
                className="flex items-center gap-1"
              >
                <Send size={12} /> Resend
              </Button>
            </div>
          </div>
        ) : (
          <span>{msg.content}</span>
        )}
      </div>
      {msg.role === "assistant" && (
        <div className="flex gap-1 mt-1">
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => { onCopyMessage(msg.content); }}
                className="text-[11px] flex items-center gap-1"
                aria-label="Copy message"
              >
                <Copy size={12} /> Copy
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy message</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => { onPinMessage(msg.content); }}
                className="text-[11px] flex items-center gap-1"
                aria-label="Pin insight"
              >
                <Pin size={12} /> Pin
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save as coaching insight</TooltipContent>
          </Tooltip>
        </div>
      )}
      {msg.role === "user" && editingMessageId !== msg.id && !loading && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => { onStartEditing(msg); }}
              className="chat-message-edit mt-1 text-[11px] flex items-center gap-1 opacity-0 transition-opacity duration-150 hover:opacity-100"
              aria-label="Edit and resend"
            >
              <Pencil size={12} /> Edit
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit and resend</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
