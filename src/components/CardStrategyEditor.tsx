import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  CardStrategyInput,
  SUGGESTED_CARD_TAGS,
  getCardStrategy,
  upsertCardStrategy,
} from '@/lib/cardStrategies';

interface Props {
  paymentModeId: string;
}

const defaultInput: CardStrategyInput = {
  tags: [],
  keepAlive: false,
  keepAliveCadenceDays: 30,
  note: null,
};

export function CardStrategyEditor({ paymentModeId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CardStrategyInput>(defaultInput);
  const [customTag, setCustomTag] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await getCardStrategy(paymentModeId);
      if (existing) {
        setForm({
          tags: existing.tags,
          keepAlive: existing.keepAlive,
          keepAliveCadenceDays: existing.keepAliveCadenceDays || 30,
          note: existing.note,
        });
      } else {
        setForm(defaultInput);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [paymentModeId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTag = (tag: string) => {
    setForm((f) =>
      f.tags.includes(tag)
        ? { ...f, tags: f.tags.filter((t) => t !== tag) }
        : { ...f, tags: [...f.tags, tag] },
    );
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (!t) return;
    if (!form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setCustomTag('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertCardStrategy(paymentModeId, {
        ...form,
        keepAliveCadenceDays: form.keepAlive ? Math.max(1, form.keepAliveCadenceDays || 30) : 30,
        note: form.note?.trim() ? form.note.trim() : null,
      });
      toast({ title: 'Strategy saved' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to save strategy', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading strategy…
      </div>
    );
  }

  const customTags = form.tags.filter((t) => !SUGGESTED_CARD_TAGS.includes(t));

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div>
        <h4 className="text-sm font-medium">Card strategy</h4>
        <p className="text-xs text-muted-foreground">Optional — leave blank if you don't have one.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Role tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_CARD_TAGS.map((tag) => {
            const active = form.tags.includes(tag);
            return (
              <Badge
                key={tag}
                variant={active ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            );
          })}
          {customTags.map((tag) => (
            <Badge key={tag} variant="default" className="cursor-pointer gap-1" onClick={() => toggleTag(tag)}>
              {tag}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomTag();
              }
            }}
            placeholder="Add custom tag"
            className="h-9"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustomTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="keep-alive" className="text-xs">Keep-alive</Label>
          <Switch
            id="keep-alive"
            checked={form.keepAlive}
            onCheckedChange={(v) => setForm((f) => ({ ...f, keepAlive: v }))}
          />
        </div>
        {form.keepAlive && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Must be used every</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.keepAliveCadenceDays || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, keepAliveCadenceDays: parseInt(e.target.value) || 0 }))
              }
              className="h-9 w-20"
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Note (optional)</Label>
        <Textarea
          value={form.note ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="e.g. 5% on groceries, milestone benefit at ₹2L spend"
          rows={2}
        />
      </div>

      <Button type="button" size="sm" variant="secondary" onClick={handleSave} disabled={saving} className="w-full">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save strategy
      </Button>
    </div>
  );
}