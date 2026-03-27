import { useRef } from "react";
import { Send, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ChatInputProps {
  input: string;
  loading: boolean;
  webAugmentationMode: string;
  webSearchSuggestion: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onRespondWebSearch: (approved: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function ChatInput({
  input,
  loading,
  webAugmentationMode,
  webSearchSuggestion,
  onInputChange,
  onSendMessage,
  onRespondWebSearch,
  onKeyDown,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${String(Math.min(el.scrollHeight, 120))}px`;
    }
  };

  return (
    <div className="pt-3.5 px-5 border-t border-sidebar-border bg-card">
      {webSearchSuggestion && (
        <div className="flex items-center gap-3 px-4 py-3 bg-secondary border border-primary rounded-md mb-2 animate-in slide-in-from-bottom-1.5 duration-250">
          <Globe size={16} className="text-primary shrink-0" />
          <span className="flex-1 text-[13px] text-muted-foreground">
            This question might benefit from a web search.
          </span>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => { onRespondWebSearch(true); }}
            >
              Search
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onRespondWebSearch(false); }}
            >
              Skip
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center mb-2">
        {webAugmentationMode !== "off" && (
          <Tooltip>
            <TooltipTrigger>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary bg-[var(--accent-subtle)] text-primary text-xs font-medium"
              >
                <Globe size={14} />
                {webAugmentationMode === "agent" ? "Research agent" : webAugmentationMode === "auto" ? "Auto search" : "Web search"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {webAugmentationMode === "agent" ? "Agent web research enabled" : webAugmentationMode === "auto" ? "Auto web search enabled" : "Simple web search enabled"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex gap-2.5 items-end pb-3.5">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => { onInputChange(e.target.value); resizeTextarea(); }}
          onKeyDown={onKeyDown}
          placeholder="Ask your coach..."
          disabled={loading}
          rows={1}
          className="flex-1 resize-none leading-5 bg-secondary min-h-0 field-sizing-normal focus:border-primary focus:shadow-[0_0_0_3px_var(--accent-subtle)] placeholder:text-muted-foreground/60"
          id="chat-input"
          aria-label="Message input"
        />
        <Button
          onClick={onSendMessage}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1"
          aria-label="Send message"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
