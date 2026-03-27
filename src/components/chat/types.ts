export interface Message {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface Session {
  id: string;
  title?: string;
  created_at: string;
}

export interface ChatProps {
  onStatusChange?: (status: "idle" | "thinking" | "replied", detail?: string) => void;
}

export interface ChatSettingsData {
  active_llm: string;
  ollama_endpoint: string;
  ollama_model: string;
  custom_system_prompt: string;
  cloud_api_key: string | null;
  cloud_model: string | null;
  web_augmentation_mode: string;
}

export interface ProgressStep {
  label: string;
  startedAt: number;
  completedAt?: number;
}
