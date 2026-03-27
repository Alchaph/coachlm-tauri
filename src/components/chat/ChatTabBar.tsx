import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
        <TooltipTrigger render={<span className="max-w-[120px] truncate" ref={spanRef}>{label}</span>} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return <span className="max-w-[120px] truncate" ref={spanRef}>{label}</span>;
}

interface ChatTabBarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  getSessionLabel: (session: Session) => string;
}

export default function ChatTabBar({
  sessions,
  currentSessionId,
  onLoadSession,
  onCloseSession,
  onCreateNewSession,
  getSessionLabel,
}: ChatTabBarProps) {
  const tabBarRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={tabBarRef}
      className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card overflow-x-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors duration-150 group",
            s.id === currentSessionId
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
          onClick={() => { onLoadSession(s.id); }}
        >
          <MessageSquare size={12} className="shrink-0" />
          <SessionLabel label={getSessionLabel(s)} />
          <span
            className="flex items-center justify-center rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-destructive"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onCloseSession(s.id); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onCloseSession(s.id); } }}
          >
            <X size={10} />
          </span>
        </button>
      ))}
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreateNewSession}
            aria-label="New chat"
            className="shrink-0"
          >
            <Plus size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New chat</TooltipContent>
      </Tooltip>
    </div>
  );
}
