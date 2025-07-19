import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useSettings, type Settings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { TestTube } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Settings>(settings);

  useEffect(() => {
    if (open) {
      setFormData(settings);
    }
  }, [open, settings]);

  const handleInputChange = (field: keyof Settings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    try {
      updateSettings(formData);
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
      onOpenChange(false);
      
      // Reload the page to apply the new settings
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData(settings); // Reset to original values
    onOpenChange(false);
  };

  const handleTest = async (field: string, value: string) => {
    if (!value) {
      toast({
        title: "Error",
        description: "Please enter a value before testing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/functions/v1/proxy/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, key: value }),
      });

      if (response.ok) {
        toast({
          title: "✅ Test Successful",
          description: `${field} connection is working properly.`,
        });
      } else {
        const errorText = await response.text();
        toast({
          title: "❌ Test Failed",
          description: errorText || `Failed to connect to ${field}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Test Failed",
        description: `Network error while testing ${field}`,
        variant: "destructive",
      });
    }
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    return '•••••••';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* n8n Endpoints */}
          <div>
            <h3 className="text-lg font-medium mb-4">n8n Endpoints</h3>
            
            {/* Workflow Webhooks Sub-group */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Workflow Webhooks</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="chatUrl">Chat URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="chatUrl"
                      type="url"
                      placeholder="https://your-n8n-instance.com/webhook/chat"
                      value={formData.chatUrl}
                      onChange={(e) => handleInputChange('chatUrl', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('chat', formData.chatUrl)}
                      className="px-3"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ingestUrl">Ingest URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ingestUrl"
                      type="url"
                      placeholder="https://your-n8n-instance.com/webhook/ingest"
                      value={formData.ingestUrl}
                      onChange={(e) => handleInputChange('ingestUrl', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('ingest', formData.ingestUrl)}
                      className="px-3"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="templateUrl">Template URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="templateUrl"
                      type="url"
                      placeholder="https://your-n8n-instance.com/webhook/template"
                      value={formData.templateUrl}
                      onChange={(e) => handleInputChange('templateUrl', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('template', formData.templateUrl)}
                      className="px-3"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* n8n API Auth Sub-group */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">n8n API Auth</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="n8nBaseUrl">n8n Base URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="n8nBaseUrl"
                      type="url"
                      placeholder="https://your-n8n-instance.com"
                      value={formData.n8nBaseUrl}
                      onChange={(e) => handleInputChange('n8nBaseUrl', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('n8n', formData.n8nBaseUrl)}
                      className="px-3"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="n8nApiKey">n8n API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="n8nApiKey"
                      type="password"
                      placeholder="Enter your n8n API key"
                      value={formData.n8nApiKey}
                      onChange={(e) => handleInputChange('n8nApiKey', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('n8n', formData.n8nApiKey)}
                      className="px-3"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Found in n8n → Settings → API
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Providers */}
          <div>
            <h3 className="text-lg font-medium mb-4">AI Providers</h3>
            <div className="grid gap-4">
              <div className="grid gap-3">
                <Label>LLM Provider</Label>
                <RadioGroup
                  value={formData.llmProvider}
                  onValueChange={(value: 'OPENAI' | 'OLLAMA') => 
                    handleInputChange('llmProvider', value)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="OPENAI" id="openai" />
                    <Label htmlFor="openai">OpenAI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="OLLAMA" id="ollama" />
                    <Label htmlFor="ollama">Ollama</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="openaiKey">OpenAI API Key</Label>
                <Input
                  id="openaiKey"
                  type="password"
                  placeholder="sk-..."
                  value={formData.openaiKey}
                  onChange={(e) => handleInputChange('openaiKey', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ollamaUrl">Ollama Base URL</Label>
                <Input
                  id="ollamaUrl"
                  type="url"
                  placeholder="http://localhost:11434"
                  value={formData.ollamaUrl}
                  onChange={(e) => handleInputChange('ollamaUrl', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Google / Maps */}
          <div>
            <h3 className="text-lg font-medium mb-4">Google / Maps</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="googleProjectId">Google Cloud Project ID</Label>
                <Input
                  id="googleProjectId"
                  placeholder="your-project-id"
                  value={formData.googleProjectId}
                  onChange={(e) => handleInputChange('googleProjectId', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="googleMapsKey">Google Maps API Key</Label>
                <Input
                  id="googleMapsKey"
                  type="password"
                  placeholder="AIza..."
                  value={formData.googleMapsKey}
                  onChange={(e) => handleInputChange('googleMapsKey', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="googleOAuthClientId">Google OAuth Client ID</Label>
                <Input
                  id="googleOAuthClientId"
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  value={formData.googleOAuthClientId}
                  onChange={(e) => handleInputChange('googleOAuthClientId', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Supabase */}
          <div>
            <h3 className="text-lg font-medium mb-4">Supabase</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supabaseUrl">Supabase URL</Label>
                <Input
                  id="supabaseUrl"
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  value={formData.supabaseUrl}
                  onChange={(e) => handleInputChange('supabaseUrl', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="supabaseKey">Supabase Anon Key</Label>
                <Input
                  id="supabaseKey"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={formData.supabaseKey}
                  onChange={(e) => handleInputChange('supabaseKey', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}