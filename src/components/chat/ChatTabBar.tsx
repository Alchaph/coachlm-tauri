import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Session } from "@/components/chat/types";

function SessionLabel({ label }: { label: string }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = spanRef.current;
    if (el) {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
  }, [label, checkOverflow]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => { checkOverflow(); });
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, [checkOverflow]);

  if (isOverflowing) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="max-w-[140px] truncate" ref={spanRef}>{label}</span>} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return <span className="max-w-[140px] truncate" ref={spanRef}>{label}</span>;
}

interface ChatSessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  getSessionLabel: (session: Session) => string;
}

export default function ChatSessionList({
  sessions,
  currentSessionId,
  onLoadSession,
  onCloseSession,
  onCreateNewSession,
  getSessionLabel,
}: ChatSessionListProps) {
  return (
    <div className="flex w-[220px] min-w-[220px] flex-col border-r border-sidebar-border bg-card px-2 py-3">
      <div className="mb-1 px-0.5">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onCreateNewSession}
        >
          <Plus size={14} />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] text-left transition-colors duration-150 group",
                s.id === currentSessionId
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              onClick={() => { onLoadSession(s.id); }}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="flex-1 overflow-hidden">
                <SessionLabel label={getSessionLabel(s)} />
              </span>
              <button
                type="button"
                className="flex items-center justify-center rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-destructive"
                aria-label="Close session"
                onClick={(e) => { e.stopPropagation(); onCloseSession(s.id); }}
              >
                <X size={10} />
              </button>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
