import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { CardStrategyInput, SUGGESTED_CARD_TAGS } from '@/lib/cardStrategies';

interface Props {
  value: CardStrategyInput;
  onChange: (next: CardStrategyInput) => void;
}

export function CardStrategyFields({ value, onChange }: Props) {
  const [customTag, setCustomTag] = useState('');

  const toggleTag = (tag: string) => {
    onChange(
      value.tags.includes(tag)
        ? { ...value, tags: value.tags.filter((t) => t !== tag) }
        : { ...value, tags: [...value.tags, tag] },
    );
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (!t) return;
    if (!value.tags.includes(t)) {
      onChange({ ...value, tags: [...value.tags, t] });
    }
    setCustomTag('');
  };

  const customTags = value.tags.filter((t) => !SUGGESTED_CARD_TAGS.includes(t));

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
            const active = value.tags.includes(tag);
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
          <Label htmlFor="keep-alive-new" className="text-xs">Keep-alive</Label>
          <Switch
            id="keep-alive-new"
            checked={value.keepAlive}
            onCheckedChange={(v) => onChange({ ...value, keepAlive: v })}
          />
        </div>
        {value.keepAlive && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Must be used every</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={value.keepAliveCadenceDays || ''}
              onChange={(e) =>
                onChange({ ...value, keepAliveCadenceDays: parseInt(e.target.value) || 0 })
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
          value={value.note ?? ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="e.g. 5% on groceries, milestone benefit at ₹2L spend"
          rows={2}
        />
      </div>
    </div>
  );
}