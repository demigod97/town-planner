// src/components/SettingsModal.tsx
import { useState, useEffect } from 'react'
import { X, Loader2, Check, AlertCircle, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateUserSettings, testLLMConnection, getUserSettings } from '../lib/api'
import type { LLMSettings } from '../lib/api'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<LLMSettings>({
    provider: 'ollama',
    model: '',
    temperature: 0.3,
    embeddingProvider: 'ollama'
  })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings()
      setSettings(userSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserSettings(settings)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (provider: string) => {
    setTesting(provider)
    try {
      const result = await testLLMConnection(provider, settings)
      setTestResults({ ...testResults, [provider]: result.success })
    } catch (error) {
      setTestResults({ ...testResults, [provider]: false })
    } finally {
      setTesting(null)
    }
  }

  const providers = [
    { 
      id: 'ollama', 
      name: 'Ollama (Local)', 
      models: ['qwen3:8b-q4_K_M', 'llama3.2', 'mistral', 'phi3']
    },
    { 
      id: 'openai', 
      name: 'OpenAI', 
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    { 
      id: 'gemini', 
      name: 'Google Gemini', 
      models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash']
    },
    { 
      id: 'llamacloud', 
      name: 'LlamaCloud (PDF Processing)', 
      models: []
    }
  ]

  const selectedProvider = providers.find(p => p.id === settings.provider)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="settings-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* LLM Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              LLM Provider
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          {selectedProvider && selectedProvider.models.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Model
              </label>
              <select
                value={settings.model || ''}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Default</option>
                {selectedProvider.models.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Embedding Provider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Embedding Provider
            </label>
            <select
              value={settings.embeddingProvider || settings.provider}
              onChange={(e) => setSettings({ ...settings, embeddingProvider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ollama">Ollama (nomic-embed-text)</option>
              <option value="openai">OpenAI (text-embedding-3-small)</option>
              <option value="gemini">Gemini (embedding-001)</option>
            </select>
          </div>

          {/* Connection Tests */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Test Connections</h3>
            <div className="space-y-2">
              {providers.filter(p => p.id !== 'llamacloud').map(provider => (
                <div key={provider.id} className="flex items-center justify-between">
                  <span className="text-sm">{provider.name}</span>
                  <button
                    onClick={() => testConnection(provider.id)}
                    disabled={testing === provider.id}
                    className="flex items-center gap-2 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testing === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testResults[provider.id] === true ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : testResults[provider.id] === false ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Provider-specific settings */}
          {settings.provider === 'ollama' && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Ollama Settings</h3>
              <p className="text-sm text-gray-600">
                Make sure Ollama is running locally at http://localhost:11434
              </p>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <code className="text-xs">ollama serve</code>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
