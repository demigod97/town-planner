import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings, type Settings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* n8n Chat Webhook */}
          <div className="grid gap-2">
            <Label htmlFor="chatUrl">n8n Chat Webhook</Label>
            <Input
              id="chatUrl"
              type="url"
              placeholder="https://your-n8n-instance.com/webhook/chat"
              value={formData.chatUrl}
              onChange={(e) => handleInputChange('chatUrl', e.target.value)}
            />
          </div>

          {/* n8n Ingest URL */}
          <div className="grid gap-2">
            <Label htmlFor="ingestUrl">n8n Ingest URL</Label>
            <Input
              id="ingestUrl"
              type="url"
              placeholder="https://your-n8n-instance.com/webhook/ingest"
              value={formData.ingestUrl}
              onChange={(e) => handleInputChange('ingestUrl', e.target.value)}
            />
          </div>

          {/* n8n Template URL */}
          <div className="grid gap-2">
            <Label htmlFor="templateUrl">n8n Template URL</Label>
            <Input
              id="templateUrl"
              type="url"
              placeholder="https://your-n8n-instance.com/webhook/template"
              value={formData.templateUrl}
              onChange={(e) => handleInputChange('templateUrl', e.target.value)}
            />
          </div>

          {/* OpenAI API Key */}
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

          {/* Ollama Base URL */}
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

          {/* LLM Provider */}
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