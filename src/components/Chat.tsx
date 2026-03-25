import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Pin, Plus, X, MessageSquare, PanelLeftClose, PanelLeftOpen, Globe, Pencil, Copy, RefreshCw, Square } from "lucide-react";
import { useToast } from "../hooks/useToast";

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
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      lineHeight: "16px",
      color: "var(--text-secondary)",
    }}>
      <span style={{
        width: 8,
        textAlign: "center",
        color: "var(--accent)",
        fontSize: 10,
      }}>
        {"\u25CF"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function CollapsedStepsSummary({ steps }: { steps: ProgressStep[] }) {
  const labels = steps.map((s) => s.label).join(" \u00B7 ");

  return (
    <div style={{
      fontSize: 11,
      color: "var(--text-muted)",
      marginBottom: 4,
      lineHeight: "16px",
    }}>
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
  const { showToast, toastElement } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [promptHistory, setPromptHistory] = useState<string[]>([]);
   const historyIndex = useRef(-1);
   const savedInput = useRef("");
   const lastSentContentRef = useRef("");
  const [webAugmentationMode, setWebAugmentationMode] = useState("off");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [completedSteps, setCompletedSteps] = useState<ProgressStep[] | null>(null);
  const lastCompletedStepsRef = useRef<ProgressStep[] | null>(null);

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

  // Keep ref in sync with state for event listeners
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
      showToast("Insight pinned", "success");
    } catch (e) {
      setError(String(e));
      showToast("Failed to pin insight", "error");
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("Copied to clipboard", "success");
    } catch {
      showToast("Failed to copy", "error");
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
    <div style={{ display: "flex", height: "100%" }}>
      <div className={`chat-sidebar${sidebarOpen ? "" : " chat-sidebar-collapsed"}`}>
        <div className="chat-sidebar-header">
           <button
             className="btn-ghost"
             onClick={() => { setSidebarOpen(false); }}
             title="Close sidebar"
             aria-label="Close sidebar"
             style={{ padding: "4px" }}
           >
            <PanelLeftClose size={16} />
          </button>
          <span style={{ flex: 1 }}>History</span>
           <button
             className="btn-ghost"
             onClick={() => { void createNewSession(); }}
             title="New chat"
             aria-label="New chat"
             style={{ padding: "4px" }}
           >
            <Plus size={16} />
          </button>
        </div>
        <div className="chat-sidebar-list">
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`chat-session-item${s.id === currentSessionId ? " chat-session-item-active" : ""}`}
              onClick={() => { void loadSession(s.id); }}
              title={getSessionLabel(s)}
            >
              <MessageSquare size={14} style={{ flexShrink: 0 }} />
              <span className="chat-session-label">{getSessionLabel(s)}</span>
              <span
                className="chat-session-close"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); void closeSession(s.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void closeSession(s.id); } }}
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-secondary)",
          }}
        >
            {!sidebarOpen && (
               <button
                 className="btn-ghost"
                 onClick={() => { setSidebarOpen(true); }}
                 title="Open sidebar"
                 aria-label="Open sidebar"
               >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {currentSessionId ? getSessionLabel(sessions.find((s) => s.id === currentSessionId) ?? { id: "", created_at: "" }) : ""}
            </span>
            <div style={{ flex: 1 }} />
         </div>

        <div
          style={{ flex: 1, overflow: "auto", padding: "16px" }}
          onScroll={handleScroll}
        >
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <MessageSquare size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
              <p>Start a conversation with your AI running coach.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
                {["Review my last week of training", "Help me plan a tempo run", "What should my easy pace be?"].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => { setInput(prompt); }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, marginTop: 12, color: "var(--text-muted)" }}>
                Tip: Be specific with running terms for best results. LLMs can misinterpret ambiguous phrases.
              </p>
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
              style={{
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {showActiveStepper && (
                <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} />
              )}
              {showThinkingLabel && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  Thinking...
                </div>
              )}
              {showCollapsedSummary && (
                <CollapsedStepsSummary steps={completedSteps} />
              )}
              <div
                className={msg.role === "user" ? "chat-message-user" : undefined}
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: msg.role === "user" ? "var(--accent-dim)" : "var(--bg-secondary)",
                  border: msg.role === "user" ? "none" : "1px solid var(--border)",
                }}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 300 }}>
                    <textarea
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
                      style={{
                        resize: "vertical",
                        lineHeight: "20px",
                        background: "var(--bg-tertiary)",
                        border: "1px solid var(--accent)",
                        borderRadius: 4,
                        padding: "8px 12px",
                      }}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        className="btn-ghost"
                        onClick={cancelEditing}
                        style={{ fontSize: 12, padding: "4px 10px" }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => { void submitEdit(); }}
                        disabled={!editContent.trim() || loading}
                        style={{ fontSize: 12, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Send size={12} /> Resend
                      </button>
                    </div>
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                   <button
                     className="btn-ghost"
                     onClick={() => { void copyMessage(msg.content); }}
                     style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                     title="Copy message"
                     aria-label="Copy message"
                   >
                    <Copy size={12} /> Copy
                  </button>
                   <button
                     className="btn-ghost"
                     onClick={() => { void pinMessage(msg.content); }}
                     style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                     title="Save as coaching insight"
                     aria-label="Pin insight"
                   >
                    <Pin size={12} /> Pin
                  </button>
                </div>
              )}
              {msg.role === "user" && editingMessageId !== msg.id && !loading && (
                 <button
                   className="btn-ghost chat-message-edit"
                   onClick={() => { startEditing(msg); }}
                   style={{ marginTop: 4, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                   title="Edit and resend"
                   aria-label="Edit and resend"
                 >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            );
          })}

           {loading && !messages.some((m) => m.id === -1) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 16 }}>
                {progressSteps.length > 0 ? (
                  <CurrentStepLabel label={progressSteps[progressSteps.length - 1].label} />
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Thinking...
                  </div>
                )}
              </div>
            )}

           {loading && messages.some((m) => m.id === -1) && (
             <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
               <button
                 className="btn-secondary"
                 onClick={() => { setLoading(false); setProgressSteps([]); onStatusChange?.("idle"); }}
                 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px" }}
               >
                 <Square size={12} /> Stop generating
                </button>
              </div>
            )}

             {error && (
               <div className="error-state" style={{ textAlign: "left", padding: "8px 14px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--danger)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                 <span>{error}</span>
                 {!loading && (
                   <button
                     className="btn-ghost"
                     onClick={() => { setError(null); setInput(lastSentContentRef.current); }}
                     aria-label="Retry"
                     style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, color: "var(--danger)" }}
                   >
                     <RefreshCw size={14} /> Retry
                   </button>
                 )}
               </div>
             )}

          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            padding: "12px 16px 0",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {webAugmentationMode !== "off" && (
              <span
                className="chat-toggle-chip chat-toggle-chip-active"
                title={webAugmentationMode === "agent" ? "Agent web research enabled" : "Simple web search enabled"}
              >
                <Globe size={14} />
                {webAugmentationMode === "agent" ? "Research agent" : "Web search"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingBottom: 12 }}>
             <textarea
               ref={textareaRef}
               value={input}
               onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
               onKeyDown={handleKeyDown}
               placeholder="Ask your coach..."
               disabled={loading}
               rows={1}
               style={{ flex: 1, resize: "none", lineHeight: "20px" }}
               id="chat-input"
               aria-label="Message input"
             />
             <button
               className="btn-primary"
               onClick={() => { void sendMessage(); }}
               disabled={loading || !input.trim()}
               style={{ display: "flex", alignItems: "center", gap: 4 }}
               aria-label="Send message"
             >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {toastElement}
    </div>
  );
}
