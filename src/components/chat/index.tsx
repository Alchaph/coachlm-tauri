import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ChatTabBar from "@/components/chat/ChatTabBar";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessageList from "@/components/chat/ChatMessageList";
import type { Message, Session, ChatProps, ChatSettingsData, ProgressStep } from "@/components/chat/types";

export default function Chat({ onStatusChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
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
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

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
        try {
          const msgs = await invoke<Message[]>("get_chat_messages", { sessionId: firstId });
          setMessages(msgs);
          setCurrentSessionId(firstId);
          shouldAutoScroll.current = true;
        } catch (e: unknown) {
          setError(String(e));
          setCurrentSessionId(firstId);
        }
      }
      try {
        const settings = await invoke<ChatSettingsData | null>("get_settings");
        if (settings) {
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
      invoke("respond_web_search_suggestion", { approved: false }).catch(() => undefined);
    }, 30_000);
    return () => { clearTimeout(timer); };
  }, [webSearchSuggestion]);

  const respondWebSearch = (approved: boolean) => {
    setWebSearchSuggestion(false);
    invoke("respond_web_search_suggestion", { approved }).catch(() => undefined);
  };

  const loadSession = async (sessionId: string) => {
    try {
      const msgs = await invoke<Message[]>("get_chat_messages", { sessionId });
      setMessages(msgs);
      setCurrentSessionId(sessionId);
      setError(null);
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
      setError(null);
      setSessions((prev) => [session, ...prev]);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (e) {
      setError(String(e));
    }
  };

  const closeSession = (sessionId: string) => {
    setDeleteSessionId(sessionId);
  };

  const doCloseSession = async (sessionId: string) => {
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
      <ChatTabBar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onLoadSession={(id) => { void loadSession(id); }}
        onCloseSession={(id) => { closeSession(id); }}
        onCreateNewSession={() => { void createNewSession(); }}
        getSessionLabel={getSessionLabel}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-sidebar-border bg-card">
          <span className="text-sm font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            {currentSessionId ? getSessionLabel(sessions.find((s) => s.id === currentSessionId) ?? { id: "", created_at: "" }) : ""}
          </span>
          <div className="flex-1" />
        </div>

        <ChatMessageList
          messages={messages}
          loading={loading}
          error={error}
          progressSteps={progressSteps}
          completedSteps={completedSteps}
          editingMessageId={editingMessageId}
          editContent={editContent}
          ollamaOffline={ollamaOffline}
          ollamaEndpoint={ollamaEndpoint}
          activeLlm={activeLlm}
          showSetupGuide={showSetupGuide}
          onEditContentChange={setEditContent}
          onStartEditing={startEditing}
          onCancelEditing={cancelEditing}
          onSubmitEdit={() => { void submitEdit(); }}
          onCopyMessage={(content) => { void copyMessage(content); }}
          onPinMessage={(content) => { void pinMessage(content); }}
          onSetInput={setInput}
          onStopGenerating={() => { setLoading(false); setProgressSteps([]); onStatusChange?.("idle"); }}
          onToggleSetupGuide={() => { setShowSetupGuide((prev) => !prev); }}
          onRetry={() => { setError(null); setShowSetupGuide(false); setInput(lastSentContentRef.current); }}
          onOllamaConnected={() => { setOllamaOffline(false); setShowSetupGuide(false); setError(null); }}
        />

        <ChatInput
          input={input}
          loading={loading}
          webAugmentationMode={webAugmentationMode}
          webSearchSuggestion={webSearchSuggestion}
          onInputChange={setInput}
          onSendMessage={() => { void sendMessage(); }}
          onRespondWebSearch={respondWebSearch}
          onKeyDown={handleKeyDown}
        />
        <ConfirmDialog
          open={deleteSessionId !== null}
          onOpenChange={(open) => { if (!open) setDeleteSessionId(null); }}
          title="Delete Chat Session"
          description="Delete this chat session? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { if (deleteSessionId) { void doCloseSession(deleteSessionId); } setDeleteSessionId(null); }}
        />
      </div>
    </div>
  );
}
