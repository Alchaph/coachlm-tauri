import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Pin, Plus, Trash2, History, Dumbbell, MessageSquare } from "lucide-react";

interface Message {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  created_at: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const s = await invoke<Session[]>("get_chat_sessions");
      setSessions(s);
      if (s.length > 0 && !currentSessionId) {
        await loadSession(s[0].id);
      }
    } catch { /* empty */ }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const msgs = await invoke<Message[]>("get_chat_messages", { sessionId });
      setMessages(msgs);
      setCurrentSessionId(sessionId);
      setShowHistory(false);
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
      setShowHistory(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await invoke("delete_chat_session", { sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setError(null);
    setLoading(true);
    shouldAutoScroll.current = true;

    if (!currentSessionId) {
      try {
        const session = await invoke<Session>("create_chat_session");
        setCurrentSessionId(session.id);
        setSessions((prev) => [session, ...prev]);
      } catch (e) {
        setError(String(e));
        setLoading(false);
        return;
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        session_id: currentSessionId ?? "",
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
          session_id: currentSessionId ?? "",
          role: "assistant",
          content: response,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const pinMessage = async (content: string) => {
    try {
      await invoke("save_pinned_insight", { content });
    } catch (e) {
      setError(String(e));
    }
  };

  const sendPlanRequest = async () => {
    const planPrompt = "Generate a training plan based on my profile and current fitness level.";
    setInput(planPrompt);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    shouldAutoScroll.current = atBottom;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      {showHistory && (
        <div
          style={{
            width: 260,
            borderRight: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Chat History</span>
            <button className="btn-ghost" onClick={createNewSession} title="New chat">
              <Plus size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: s.id === currentSessionId ? "var(--bg-hover)" : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  margin: "2px 0",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
                <button
                  className="btn-ghost"
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  style={{ padding: 2 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
          <button className="btn-ghost" onClick={() => setShowHistory(!showHistory)} title="Chat history">
            <History size={18} />
          </button>
          <button className="btn-ghost" onClick={createNewSession} title="New chat">
            <Plus size={18} />
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={sendPlanRequest} title="Generate Training Plan" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Dumbbell size={16} />
            <span style={{ fontSize: 12 }}>Generate Plan</span>
          </button>
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
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
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
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {msg.role === "assistant" && (
                <button
                  className="btn-ghost"
                  onClick={() => pinMessage(msg.content)}
                  style={{ marginTop: 4, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                  title="Save as coaching insight"
                >
                  <Pin size={12} /> Pin
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px 12px 12px 2px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="error-state" style={{ textAlign: "left", padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid var(--danger)" }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            display: "flex",
            gap: 8,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach..."
            disabled={loading}
            style={{ flex: 1 }}
            id="chat-input"
          />
          <button
            className="btn-primary"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
