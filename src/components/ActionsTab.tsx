import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Cpu, 
  FileText, 
  MapPin, 
  Loader2, 
  Check, 
  AlertCircle,
  RefreshCw,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { testLLMConnection, updateUserSettings } from "@/lib/api";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";

interface ActionsTabProps {
  notebookId: string;
  currentSessionId: string | null;
  onClose?: () => void;
}

export const ActionsTab = ({ notebookId, currentSessionId, onClose }: ActionsTabProps) => {
  const { settings, updateSettings } = useSettings();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const providers = [
    { 
      id: 'OLLAMA', 
      name: 'Ollama (Local)', 
      models: ['qwen3:8b-q4_K_M', 'llama3.2', 'mistral', 'phi3'],
      icon: <Cpu className="w-4 h-4" />
    },
    { 
      id: 'OPENAI', 
      name: 'OpenAI', 
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      icon: <Zap className="w-4 h-4" />
    }
  ];

  const selectedProvider = providers.find(p => p.id === localSettings.llmProvider);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      updateSettings(localSettings);
      await updateUserSettings(localSettings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error('Settings save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (provider: string) => {
    setTesting(provider);
    try {
      const result = await testLLMConnection(provider.toLowerCase(), localSettings);
      setTestResults({ ...testResults, [provider]: result.success });
      toast.success(`${provider} connection ${result.success ? 'successful' : 'failed'}`);
    } catch (error) {
      setTestResults({ ...testResults, [provider]: false });
      toast.error(`${provider} connection failed`);
    } finally {
      setTesting(null);
    }
  };

  const handleProviderToggle = (checked: boolean) => {
    const newProvider = checked ? 'OLLAMA' : 'OPENAI';
    setLocalSettings({ ...localSettings, llmProvider: newProvider });
  };

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Actions & Settings
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* LLM Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                LLM Settings
              </h3>

              {/* Provider Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {selectedProvider?.icon}
                  <div>
                    <Label className="font-medium">{selectedProvider?.name}</Label>
                    <p className="text-xs text-muted-foreground">
                      {localSettings.llmProvider === 'OLLAMA' ? 'Local AI processing' : 'Cloud AI service'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.llmProvider === 'OLLAMA'}
                  onCheckedChange={handleProviderToggle}
                />
              </div>

              {/* Model Selection */}
              {selectedProvider && selectedProvider.models.length > 0 && (
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={localSettings.model || ''}
                    onValueChange={(value) => setLocalSettings({ ...localSettings, model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Default</SelectItem>
                      {selectedProvider.models.map(model => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Temperature */}
              <div className="space-y-2">
                <Label>Temperature: {localSettings.temperature}</Label>
                <Slider
                  value={[localSettings.temperature || 0.3]}
                  onValueChange={([value]) => setLocalSettings({ ...localSettings, temperature: value })}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Connection Tests */}
              <div className="space-y-2">
                <Label>Connection Status</Label>
                <div className="space-y-2">
                  {providers.map(provider => (
                    <div key={provider.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {provider.icon}
                        <span className="text-sm">{provider.name}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(provider.id)}
                        disabled={testing === provider.id}
                      >
                        {testing === provider.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : testResults[provider.id] === true ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : testResults[provider.id] === false ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>

            <Separator />

            {/* Quick Actions Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quick Actions
              </h3>

              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Permit Template
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="w-4 h-4 mr-2" />
                  Location Analysis
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>

            <Separator />

            {/* Session Info */}
            {currentSessionId && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Current Session</h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Session ID:</strong> {currentSessionId.slice(0, 8)}...</p>
                    <p><strong>Notebook:</strong> {notebookId.slice(0, 8)}...</p>
                    <p><strong>Provider:</strong> {localSettings.llmProvider}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </ComponentErrorBoundary>
  );
};