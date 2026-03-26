import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Monitor, Apple, Terminal, ExternalLink, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface OllamaSetupGuideProps {
  endpoint: string;
  onConnected?: () => void;
  compact?: boolean;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-secondary rounded-md px-3 py-2 text-[13px] font-mono text-foreground overflow-x-auto select-all">
      {children}
    </pre>
  );
}

export default function OllamaSetupGuide({ endpoint, onConnected, compact = false }: OllamaSetupGuideProps) {
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const ok = await invoke<boolean>("check_ollama_status", { endpoint });
      if (ok) {
        setConnected(true);
        toast.success("Ollama is running");
        onConnected?.();
      } else {
        toast.error("Ollama is still not reachable");
      }
    } catch {
      toast.error("Failed to check Ollama status");
    } finally {
      setChecking(false);
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-green-500 text-sm font-medium py-2">
        <CheckCircle size={16} />
        <span>Ollama is connected</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", compact ? "text-sm" : "")}>
      {!compact && (
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-foreground m-0">Ollama is not running</h3>
          <p className="text-sm text-muted-foreground m-0">
            CoachLM uses Ollama to run AI models locally on your machine.
            Follow the steps below to get started.
          </p>
        </div>
      )}

      <Tabs defaultValue="macos">
        <TabsList className="w-full">
          <TabsTrigger value="macos" className="flex items-center gap-1.5">
            <Apple size={14} /> macOS
          </TabsTrigger>
          <TabsTrigger value="windows" className="flex items-center gap-1.5">
            <Monitor size={14} /> Windows
          </TabsTrigger>
          <TabsTrigger value="linux" className="flex items-center gap-1.5">
            <Terminal size={14} /> Linux
          </TabsTrigger>
        </TabsList>

        <TabsContent value="macos">
          <div className="flex flex-col gap-3 pt-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">1. Install Ollama</p>
              <p className="text-xs text-muted-foreground mb-2">
                Download from the official website or install via Homebrew:
              </p>
              <CodeBlock>brew install ollama</CodeBlock>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">2. Start the server</p>
              <CodeBlock>ollama serve</CodeBlock>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">3. Pull a model</p>
              <p className="text-xs text-muted-foreground mb-2">
                In a new terminal window, download a model:
              </p>
              <CodeBlock>ollama pull llama3</CodeBlock>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="windows">
          <div className="flex flex-col gap-3 pt-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">1. Install Ollama</p>
              <p className="text-xs text-muted-foreground mb-2">
                Download the installer from the official website and run it.
                Ollama will start automatically as a background service.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">2. Pull a model</p>
              <p className="text-xs text-muted-foreground mb-2">
                Open PowerShell or Command Prompt and run:
              </p>
              <CodeBlock>ollama pull llama3</CodeBlock>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">3. Verify it is running</p>
              <p className="text-xs text-muted-foreground mb-2">
                Ollama runs as a system tray app on Windows. If it is not running,
                launch it from the Start menu.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="linux">
          <div className="flex flex-col gap-3 pt-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">1. Install Ollama</p>
              <p className="text-xs text-muted-foreground mb-2">
                Run the install script:
              </p>
              <CodeBlock>curl -fsSL https://ollama.com/install.sh | sh</CodeBlock>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">2. Start the server</p>
              <p className="text-xs text-muted-foreground mb-2">
                Start Ollama as a systemd service or run it directly:
              </p>
              <CodeBlock>ollama serve</CodeBlock>
              <p className="text-xs text-muted-foreground mt-1">
                Or enable it as a service:
              </p>
              <CodeBlock>sudo systemctl enable --now ollama</CodeBlock>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">3. Pull a model</p>
              <p className="text-xs text-muted-foreground mb-2">
                In a new terminal, download a model:
              </p>
              <CodeBlock>ollama pull llama3</CodeBlock>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void checkConnection()}
          disabled={checking}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={cn(checking && "animate-spin")} />
          Check Connection
        </Button>
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink size={12} /> ollama.com/download
        </a>
      </div>
    </div>
  );
}
