import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Pin, Plus, X, MessageSquare, PanelLeftClose, PanelLeftOpen, Check, Globe, Pencil } from "lucide-react";

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
  web_search_enabled: boolean;
  web_search_provider: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function Chat({ onStatusChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking...");
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const historyIndex = useRef(-1);
  const savedInput = useRef("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

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
        setWebSearchEnabled(settings.web_search_enabled);
      } catch {
        // Settings may not exist yet on first run
      }
    };
    void init();
  }, [refreshSessions]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      cleanup = await listen<{ status: string }>("chat:send:progress", (event) => {
        setLoadingStatus(event.payload.status);
        onStatusChange?.("thinking", event.payload.status);
      });
    })();
    return () => { cleanup?.(); };
  }, [onStatusChange]);

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
    setPromptHistory((prev) => [content, ...prev]);
    historyIndex.current = -1;
    savedInput.current = "";
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);
    setLoading(true);
    setLoadingStatus("Thinking...");
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          session_id: activeSessionId,
          role: "assistant",
          content: response,
          created_at: new Date().toISOString(),
        },
      ]);
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

  const toggleWebSearch = async () => {
    const newValue = !webSearchEnabled;
    setWebSearchEnabled(newValue);
    try {
      const settings = await invoke<ChatSettingsData>("get_settings");
      await invoke("save_settings", {
        data: { ...settings, web_search_enabled: newValue },
      });
    } catch {
      setWebSearchEnabled(!newValue);
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
    setLoadingStatus("Thinking...");
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          session_id: currentSessionId,
          role: "assistant",
          content: response,
          created_at: new Date().toISOString(),
        },
      ]);
      onStatusChange?.("replied");
    } catch (e) {
      setError(String(e));
      onStatusChange?.("idle");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3000);
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
            style={{ padding: "4px" }}
          >
            <PanelLeftClose size={16} />
          </button>
          <span style={{ flex: 1 }}>History</span>
          <button
            className="btn-ghost"
            onClick={() => { void createNewSession(); }}
            title="New chat"
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
              <p style={{ fontSize: 12, marginTop: 8 }}>Ask about training, pacing, race prep, or anything running-related.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
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
                <button
                  className="btn-ghost"
                  onClick={() => { void pinMessage(msg.content); }}
                  style={{ marginTop: 4, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                  title="Save as coaching insight"
                >
                  <Pin size={12} /> Pin
                </button>
              )}
              {msg.role === "user" && editingMessageId !== msg.id && !loading && (
                <button
                  className="btn-ghost chat-message-edit"
                  onClick={() => { startEditing(msg); }}
                  style={{ marginTop: 4, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                  title="Edit and resend"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
          ))}

          {loading && (
             <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
               <div
                 style={{
                  padding: "10px 14px",
                    borderRadius: 6,
                    background: "var(--bg-secondary)",
                   border: "1px solid var(--border)",
                   color: "var(--text-muted)",
                 }}
               >
                  {loadingStatus}
               </div>
            </div>
          )}

            {error && (
               <div className="error-state" style={{ textAlign: "left", padding: "8px 14px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--danger)" }}>
               {error}
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
            <button
              className={`chat-toggle-chip${webSearchEnabled ? " chat-toggle-chip-active" : ""}`}
              onClick={() => { void toggleWebSearch(); }}
              title={webSearchEnabled ? "Disable web search" : "Enable web search"}
            >
              <Globe size={14} />
              Web search
            </button>
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
            />
            <button
              className="btn-primary"
              onClick={() => { void sendMessage(); }}
              disabled={loading || !input.trim()}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
