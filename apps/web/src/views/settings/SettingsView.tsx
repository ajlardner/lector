import { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import { useAppStore } from '@/store/index.js';
import { toast } from 'sonner';

export const SettingsView = () => {
  const mode = useAppStore((s) => s.mode);
  const apiKey = useAppStore((s) => s.apiKey);
  const setMode = useAppStore((s) => s.setMode);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const [draft, setDraft] = useState(apiKey);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      <section className="space-y-2">
        <Label>Translation mode</Label>
        <div className="flex items-center justify-between border rounded-md px-4 py-3">
          <div>
            <div className="font-medium">
              {mode === 'demo' ? 'Demo mode' : 'Use my own key'}
            </div>
            <p className="text-xs text-muted-foreground">
              Demo routes LLM calls through our server (rate-limited). Your own key goes directly to Anthropic from your browser.
            </p>
          </div>
          <Switch
            checked={mode === 'byo-key'}
            onCheckedChange={(checked) => setMode(checked ? 'byo-key' : 'demo')}
          />
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="api-key">Anthropic API key (BYO-key mode)</Label>
        <Input
          id="api-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-..."
        />
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setApiKey(draft.trim());
              toast.success('Key saved');
            }}
            disabled={!draft.trim() || draft === apiKey}
          >
            Save key
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDraft('');
              setApiKey('');
              toast.success('Key cleared');
            }}
            disabled={!apiKey}
          >
            Clear
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Stored in your browser. Never sent to our backend.
        </p>
      </section>
    </div>
  );
};
