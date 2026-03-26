import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Pin, Plus, X, MessageSquare, PanelLeftClose, PanelLeftOpen, Globe, Pencil, Copy, RefreshCw, Square, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import OllamaSetupGuide from "@/components/OllamaSetupGuide";

interface Message {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  title?: string;
  created_at: string;
}

interface ChatProps {
  onStatusChange?: (status: "idle" | "thinking" | "replied", detail?: string) => void;
}

interface ChatSettingsData {
  active_llm: string;
  ollama_endpoint: string;
  ollama_model: string;
  custom_system_prompt: string;
  cloud_api_key: string | null;
  cloud_model: string | null;
  web_augmentation_mode: string;
}

interface ProgressStep {
  label: string;
  startedAt: number;
  completedAt?: number;
}

function CurrentStepLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
      <span className="w-2 text-center text-[10px] text-primary">
        {"\u25CF"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function CollapsedStepsSummary({ steps }: { steps: ProgressStep[] }) {
  const labels = steps.map((s) => s.label).join(" \u00B7 ");

  return (
    <div className="text-[11px] leading-4 text-muted-foreground/60 mb-1">
      {labels}
    </div>
  );
}

export default function Chat({ onStatusChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [promptHistory, setPromptHistory] = useState<string[]>([]);
   const historyIndex = useRef(-1);
   const savedInput = useRef("");
   const lastSentContentRef = useRef("");
  const [webAugmentationMode, setWebAugmentationMode] = useState("off");
  const [webSearchSuggestion, setWebSearchSuggestion] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [completedSteps, setCompletedSteps] = useState<ProgressStep[] | null>(null);
  const lastCompletedStepsRef = useRef<ProgressStep[] | null>(null);
  const [ollamaOffline, setOllamaOffline] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [activeLlm, setActiveLlm] = useState("ollama");
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${String(Math.min(el.scrollHeight, 120))}px`;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    if (!loading && progressSteps.length > 0) {
      const finalized = progressSteps.map((s, i) =>
        i === progressSteps.length - 1 && !s.completedAt ? { ...s, completedAt: Date.now() } : s,
      );
      setCompletedSteps(finalized);
      lastCompletedStepsRef.current = finalized;
    }
    if (loading) {
      setCompletedSteps(null);
    }
  }, [loading, progressSteps]);

  const refreshSessions = useCallback(async () => {
    try {
      const s = await invoke<Session[]>("get_chat_sessions");
      setSessions(s);
      return s;
    } catch (e: unknown) {
      setError(String(e));
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const s = await refreshSessions();
      if (s.length > 0) {
        const firstId = s[0].id;
        const msgs = await invoke<Message[]>("get_chat_messages", { sessionId: firstId });
        setMessages(msgs);
        setCurrentSessionId(firstId);
        shouldAutoScroll.current = true;
      }
      try {
        const settings = await invoke<ChatSettingsData>("get_settings");
        setWebAugmentationMode(settings.web_augmentation_mode);
        setActiveLlm(settings.active_llm);
        setOllamaEndpoint(settings.ollama_endpoint || "http://localhost:11434");

        const isOllama = settings.active_llm === "ollama" || settings.active_llm === "local" || !settings.active_llm;
        if (isOllama) {
          const connected = await invoke<boolean>("check_ollama_status", {
            endpoint: settings.ollama_endpoint || "http://localhost:11434",
          });
          setOllamaOffline(!connected);
        }
      } catch {
        // Settings may not exist yet on first run
      }
    };
    void init();
  }, [refreshSessions]);

  useEffect(() => {
    const state = { cancelled: false };
    let unlisten: (() => void) | undefined;
    void (async () => {
      const fn = await listen<{ session_id: string; status: string }>("chat:send:progress", (event) => {
        if (state.cancelled) return;
        if (event.payload.session_id && event.payload.session_id !== currentSessionIdRef.current) {
          return;
        }
        const now = Date.now();
        setProgressSteps((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].label === event.payload.status) {
            return prev;
          }
          const updated = prev.length > 0
            ? prev.map((step, i) => i === prev.length - 1 && !step.completedAt ? { ...step, completedAt: now } : step)
            : prev;
          return [...updated, { label: event.payload.status, startedAt: now }];
        });
        onStatusChange?.("thinking", event.payload.status);
      });
      if (state.cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();
    return () => { state.cancelled = true; unlisten?.(); };
  }, [onStatusChange]);

  useEffect(() => {
    const state = { cancelled: false };
    let unlisten: (() => void) | undefined;
    void (async () => {
      const fn = await listen<{ step: string; detail: string; iteration: number }>("research:progress", (event) => {
        if (state.cancelled) return;
        const label = `Research: ${event.payload.step} — ${event.payload.detail}`;
        const now = Date.now();
        setProgressSteps((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].label === label) {
            return prev;
          }
          const updated = prev.length > 0
            ? prev.map((step, i) => i === prev.length - 1 && !step.completedAt ? { ...step, completedAt: now } : step)
            : prev;
          return [...updated, { label, startedAt: now }];
        });
      });
      if (state.cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();
    return () => { state.cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    const state = { cancelled: false };
    let unlisten: (() => void) | undefined;
    void (async () => {
      const fn = await listen<{ session_id: string; content: string; done: boolean }>("chat:send:chunk", (event) => {
        if (state.cancelled) return;
        if (event.payload.session_id && event.payload.session_id !== currentSessionIdRef.current) {
          return;
        }
        if (event.payload.done) {
          return;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (prev.length > 0 && last.role === "assistant" && last.id === -1) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + event.payload.content },
            ];
          }
          return [
            ...prev,
            {
              id: -1,
              session_id: "",
              role: "assistant",
              content: event.payload.content,
              created_at: new Date().toISOString(),
            },
          ];
        });
      });
      if (state.cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();
    return () => { state.cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    const state = { cancelled: false };
    let unlisten: (() => void) | undefined;
    void (async () => {
      const fn = await listen<{ session_id: string }>("web-search:suggest", (event) => {
        if (state.cancelled) return;
        if (event.payload.session_id && event.payload.session_id !== currentSessionIdRef.current) {
          return;
        }
        setWebSearchSuggestion(true);
      });
      if (state.cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();
    return () => { state.cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!webSearchSuggestion) return;
    const timer = setTimeout(() => {
      setWebSearchSuggestion(false);
      void invoke("respond_web_search_suggestion", { approved: false });
    }, 30_000);
    return () => { clearTimeout(timer); };
  }, [webSearchSuggestion]);

  const respondWebSearch = (approved: boolean) => {
    setWebSearchSuggestion(false);
    void invoke("respond_web_search_suggestion", { approved });
  };

  const loadSession = async (sessionId: string) => {
    try {
      const msgs = await invoke<Message[]>("get_chat_messages", { sessionId });
      setMessages(msgs);
      setCurrentSessionId(sessionId);
      shouldAutoScroll.current = true;
    } catch (e) {
      setError(String(e));
    }
  };

   const createNewSession = async () => {
     try {
       const session = await invoke<Session>("create_chat_session");
       setCurrentSessionId(session.id);
       setMessages([]);
       setSessions((prev) => [session, ...prev]);
       setTimeout(() => { textareaRef.current?.focus(); }, 50);
     } catch (e) {
       setError(String(e));
     }
   };

  const closeSession = async (sessionId: string) => {
    const confirmed = await ask("Delete this chat session?", { title: "CoachLM", kind: "warning" });
    if (!confirmed) return;
    try {
      await invoke("delete_chat_session", { sessionId });
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (currentSessionId === sessionId) {
        if (remaining.length > 0) {
          await loadSession(remaining[0].id);
        } else {
          setMessages([]);
          setCurrentSessionId(null);
        }
      }
    } catch (e) {
      setError(String(e));
    }
  };

   const sendMessage = async () => {
     if (!input.trim() || loading) return;
     const content = input.trim();
     lastSentContentRef.current = content;
    setPromptHistory((prev) => [content, ...prev]);
    historyIndex.current = -1;
    savedInput.current = "";
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);
    setLoading(true);
    setProgressSteps([]);
    shouldAutoScroll.current = true;
    onStatusChange?.("thinking");

    let activeSessionId = currentSessionId;

    if (!activeSessionId) {
      try {
        const session = await invoke<Session>("create_chat_session");
        activeSessionId = session.id;
        setCurrentSessionId(session.id);
        setSessions((prev) => [session, ...prev]);
      } catch (e) {
        setError(String(e));
        setLoading(false);
        onStatusChange?.("idle");
        return;
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        session_id: activeSessionId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const response = await invoke<string>("send_message", { content });
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== -1);
        return [
          ...filtered,
          {
            id: Date.now() + 1,
            session_id: activeSessionId,
            role: "assistant",
            content: response,
            created_at: new Date().toISOString(),
          },
        ];
      });
      onStatusChange?.("replied");
      await refreshSessions();
    } catch (e) {
      setError(String(e));
      onStatusChange?.("idle");
    } finally {
      setLoading(false);
    }
  };

  const pinMessage = async (content: string) => {
    try {
      await invoke("save_pinned_insight", { content });
      toast.success("Insight pinned");
    } catch (e) {
      setError(String(e));
      toast.error("Failed to pin insight");
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const submitEdit = async () => {
    if (!editContent.trim() || loading || editingMessageId === null || !currentSessionId) return;

    const msgId = editingMessageId;
    const newContent = editContent.trim();
    setEditingMessageId(null);
    setEditContent("");
    setError(null);
    setLoading(true);
    setProgressSteps([]);
    shouldAutoScroll.current = true;
    onStatusChange?.("thinking");

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId);
      if (idx === -1) return prev;
      const updated = prev.slice(0, idx + 1);
      updated[idx] = { ...updated[idx], content: newContent };
      return updated;
    });

    try {
      const response = await invoke<string>("edit_and_resend", {
        sessionId: currentSessionId,
        messageId: msgId,
        content: newContent,
      });
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== -1);
        return [
          ...filtered,
          {
            id: Date.now(),
            session_id: currentSessionId,
            role: "assistant",
            content: response,
            created_at: new Date().toISOString(),
          },
        ];
      });
      onStatusChange?.("replied");
    } catch (e) {
      setError(String(e));
      onStatusChange?.("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    shouldAutoScroll.current = atBottom;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
      return;
    }

    if (e.key === "ArrowUp" && promptHistory.length > 0) {
      const el = textareaRef.current;
      const cursorAtStart = el ? el.selectionStart === 0 && el.selectionEnd === 0 : true;
      if (cursorAtStart) {
        e.preventDefault();
        if (historyIndex.current === -1) {
          savedInput.current = input;
        }
        const nextIndex = Math.min(historyIndex.current + 1, promptHistory.length - 1);
        historyIndex.current = nextIndex;
        setInput(promptHistory[nextIndex]);
      }
    }

    if (e.key === "ArrowDown") {
      const el = textareaRef.current;
      const cursorAtEnd = el ? el.selectionStart === el.value.length : true;
      if (cursorAtEnd && historyIndex.current >= 0) {
        e.preventDefault();
        const nextIndex = historyIndex.current - 1;
        historyIndex.current = nextIndex;
        if (nextIndex < 0) {
          setInput(savedInput.current);
        } else {
          setInput(promptHistory[nextIndex]);
        }
      }
    }
  };

  const getSessionLabel = (session: Session): string => {
    if (session.title) return session.title;
    return "New Chat";
  };

  return (
    <div className="flex h-full">
      <div className={cn(
        "flex flex-col bg-card border-r border-border overflow-hidden transition-[width,min-width] duration-250",
        sidebarOpen ? "w-60 min-w-[240px]" : "w-0 min-w-0 border-r-0"
      )}>
        <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border whitespace-nowrap">
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setSidebarOpen(false); }}
                aria-label="Close sidebar"
              >
                <PanelLeftClose size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close sidebar</TooltipContent>
          </Tooltip>
          <span className="flex-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">History</span>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { void createNewSession(); }}
                aria-label="New chat"
              >
                <Plus size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </div>
        <ScrollArea className="flex-1 p-1.5 min-w-0">
          {sessions.map((s) => (
            <Tooltip key={s.id}>
              <TooltipTrigger
                render={
                  <button
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-3 py-2.5 my-px rounded-sm text-[13px] font-sans cursor-pointer border-none overflow-hidden transition-colors duration-150 min-w-0",
                      s.id === currentSessionId
                        ? "bg-accent text-foreground font-medium"
                        : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                    onClick={() => { void loadSession(s.id); }}
                  />
                }
              >
                <MessageSquare size={14} className="shrink-0" />
                <span className="flex-1 truncate min-w-0">{getSessionLabel(s)}</span>
                <span
                  className="flex items-center justify-center rounded-sm p-0.5 opacity-0 shrink-0 transition-opacity duration-150 hover:bg-accent hover:text-destructive [button:hover_&]:opacity-100"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); void closeSession(s.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void closeSession(s.id); } }}
                >
                  <X size={12} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{getSessionLabel(s)}</TooltipContent>
            </Tooltip>
          ))}
        </ScrollArea>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-sidebar-border bg-card">
          {!sidebarOpen && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setSidebarOpen(true); }}
                  aria-label="Open sidebar"
                >
                  <PanelLeftOpen size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open sidebar</TooltipContent>
            </Tooltip>
          )}
          <span className="text-sm font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            {currentSessionId ? getSessionLabel(sessions.find((s) => s.id === currentSessionId) ?? { id: "", created_at: "" }) : ""}
          </span>
          <div className="flex-1" />
        </div>

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
                    onConnected={() => { setOllamaOffline(false); }}
                  />
                </div>
              ) : (
                <>
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Start a conversation with your AI running coach.</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {["Review my last week of training", "Help me plan a tempo run", "What should my easy pace be?"].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => { setInput(prompt); }}
                        className="px-3.5 py-2 text-xs bg-secondary border border-border rounded-md text-muted-foreground cursor-pointer transition-colors duration-150 hover:border-muted-foreground hover:text-foreground"
                      >
                        {prompt}
                      </button>
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
            const isStreaming = msg.id === -1;
            const showActiveStepper = isStreaming && loading && progressSteps.length > 0;
            const showThinkingLabel = isStreaming && loading && progressSteps.length === 0;
            const showCollapsedSummary = isLastAssistant && !isStreaming && !loading && completedSteps !== null && completedSteps.length > 0;

            return (
            <div
              key={msg.id}
              className={cn(
                "mb-4 flex flex-col",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              {showActiveStepper && (
                <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} />
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
                      onChange={(e) => { setEditContent(e.target.value); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void submitEdit();
                        }
                        if (e.key === "Escape") {
                          cancelEditing();
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
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => { void submitEdit(); }}
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
                        onClick={() => { void copyMessage(msg.content); }}
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
                        onClick={() => { void pinMessage(msg.content); }}
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
                      onClick={() => { startEditing(msg); }}
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
          })}

          {loading && !messages.some((m) => m.id === -1) && (
            <div className="flex flex-col items-start mb-4">
              {progressSteps.length > 0 ? (
                <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} />
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
                onClick={() => { setLoading(false); setProgressSteps([]); onStatusChange?.("idle"); }}
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
                      onClick={() => { setShowSetupGuide((prev) => !prev); }}
                      aria-label="Setup guide"
                      className="flex items-center gap-1 text-muted-foreground"
                    >
                      <HelpCircle size={14} /> {showSetupGuide ? "Hide Guide" : "Setup Guide"}
                    </Button>
                  )}
                  {!loading && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => { setError(null); setShowSetupGuide(false); setInput(lastSentContentRef.current); }}
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
                    onConnected={() => { setOllamaOffline(false); setShowSetupGuide(false); setError(null); }}
                  />
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

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
                  onClick={() => { respondWebSearch(true); }}
                >
                  Search
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { respondWebSearch(false); }}
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
              onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach..."
              disabled={loading}
              rows={1}
              className="flex-1 resize-none leading-5 bg-secondary min-h-0 field-sizing-normal focus:border-primary focus:shadow-[0_0_0_3px_var(--accent-subtle)] placeholder:text-muted-foreground/60"
              id="chat-input"
              aria-label="Message input"
            />
            <Button
              onClick={() => { void sendMessage(); }}
              disabled={loading || !input.trim()}
              className="flex items-center gap-1"
              aria-label="Send message"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
