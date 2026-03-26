import { ExternalLink, Key, UserPlus, Clipboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CloudProviderGuideProps {
  provider: "groq" | "openrouter";
  compact?: boolean;
}

interface ProviderInfo {
  name: string;
  url: string;
  keysUrl: string;
  keyPrefix: string;
  signUpSteps: string[];
  freeModels: string[];
}

const PROVIDERS: Record<"groq" | "openrouter", ProviderInfo> = {
  groq: {
    name: "Groq",
    url: "https://console.groq.com",
    keysUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_",
    signUpSteps: [
      "Go to console.groq.com and create a free account",
      "Navigate to API Keys in the left sidebar",
      'Click "Create API Key" and give it a name',
      "Copy the key (starts with gsk_) and paste it into CoachLM",
    ],
    freeModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
    ],
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai",
    keysUrl: "https://openrouter.ai/keys",
    keyPrefix: "sk-or-",
    signUpSteps: [
      "Go to openrouter.ai and sign up (Google or email)",
      "Navigate to openrouter.ai/keys",
      'Click "Create Key" and give it a name',
      "Copy the key (starts with sk-or-) and paste it into CoachLM",
    ],
    freeModels: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
      "google/gemma-2-9b-it:free",
    ],
  },
};

const STEP_ICONS = [UserPlus, Key, Clipboard, Clipboard] as const;

export default function CloudProviderGuide({ provider, compact = false }: CloudProviderGuideProps) {
  const info = PROVIDERS[provider];

  return (
    <div className={cn("flex flex-col gap-3", compact ? "text-sm" : "")}>
      {!compact && (
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-foreground m-0">
            Get your {info.name} API key
          </h3>
          <p className="text-sm text-muted-foreground m-0">
            {info.name} offers free API access to large language models.
            Follow the steps below to get your key.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {info.signUpSteps.map((step, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground mt-0.5">
                <Icon size={11} />
              </div>
              <div>
                <p className="text-sm text-foreground m-0">
                  <span className="font-medium">{i + 1}.</span> {step}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-border bg-secondary p-3 mt-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={13} className="text-primary" />
          <span className="text-xs font-medium text-foreground">Suggested free models</span>
        </div>
        <div className="flex flex-col gap-1">
          {info.freeModels.map((model) => (
            <code key={model} className="text-xs text-muted-foreground font-mono">
              {model}
            </code>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <a
          href={info.keysUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} /> {info.keysUrl.replace("https://", "")}
        </a>
      </div>
    </div>
  );
}
