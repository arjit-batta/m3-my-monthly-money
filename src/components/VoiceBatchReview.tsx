import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, IndianRupee } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCategories, getPaymentModes, addExpense } from '@/lib/database';
import { Category, PaymentMode } from '@/types/expense';
import { track } from '@/lib/analytics';
import { format } from 'date-fns';
import { LoadingState, ErrorState } from '@/components/LoadingError';

export type BatchEntryInput = {
  amount: number;
  category_id: string | null;
  sub_category_id: string | null;
  payment_mode_id: string | null;
  note: string;
  matched_by: 'mapping' | 'ai';
};

type Row = {
  key: string;
  amount: string;
  categoryId: string;
  subCategoryId: string;
  paymentModeId: string;
  note: string;
  keyword: string;
  matchedBy: 'mapping' | 'ai';
};

function deriveKeyword(note: string): string {
  return note
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b\d+(\.\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

interface Props {
  open: boolean;
  entries: BatchEntryInput[];
  onOpenChange: (open: boolean) => void;
  onSavedAll?: () => void;
}

export function VoiceBatchReview({ open, entries, onOpenChange, onSavedAll }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, modes] = await Promise.all([getCategories(), getPaymentModes()]);
      setCategories(cats);
      setPaymentModes(modes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRows(
      entries.map((e, i) => ({
        key: `${i}-${Math.random().toString(36).slice(2, 8)}`,
        amount: e.amount > 0 ? String(e.amount) : '',
        categoryId: e.category_id ?? '',
        subCategoryId: e.sub_category_id ?? '',
        paymentModeId: e.payment_mode_id ?? '',
        note: e.note ?? '',
        keyword: deriveKeyword(e.note ?? ''),
        matchedBy: e.matched_by,
      })),
    );
  }, [open, entries]);

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const allValid =
    rows.length > 0 &&
    rows.every((r) => {
      const amt = parseFloat(r.amount);
      if (!(amt > 0)) return false;
      if (!r.categoryId) return false;
      const cat = categoriesById.get(r.categoryId);
      const hasSubs = !!cat && cat.subCategories.length > 0;
      if (hasSubs && !r.subCategoryId) return false;
      if (!r.paymentModeId) return false;
      return true;
    });

  const handleSaveAll = async () => {
    if (!allValid || saving) return;
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let savedCount = 0;
    let failed = 0;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    for (const r of rows) {
      try {
        await addExpense({
          amount: parseFloat(r.amount),
          date: today,
          categoryId: r.categoryId,
          subCategoryId: r.subCategoryId || '',
          paymentModeId: r.paymentModeId,
          notes: r.note.trim() || undefined,
        });
        track('expense_added', { capture_method: 'batch_voice' });
        savedCount += 1;

        const keyword = (r.keyword || deriveKeyword(r.note)).trim();
        if (userId && keyword && r.categoryId) {
          try {
            await supabase.from('voice_mappings').upsert(
              {
                user_id: userId,
                keyword,
                category_id: r.categoryId,
                sub_category_id: r.subCategoryId || null,
              },
              { onConflict: 'user_id,keyword' },
            );
          } catch (err) {
            console.error('Failed to upsert voice mapping', err);
          }
        }
      } catch (err) {
        failed += 1;
        console.error('Failed to save batch expense', err);
      }
    }

    setSaving(false);

    if (failed === 0) {
      toast({
        title: 'Expenses saved',
        description: `${savedCount} expense${savedCount === 1 ? '' : 's'} added`,
      });
      onSavedAll?.();
      onOpenChange(false);
    } else {
      toast({
        title: 'Some expenses failed',
        description: `${savedCount} saved, ${failed} failed. Please retry.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Review entries</SheetTitle>
          <SheetDescription>
            We parsed {entries.length} expenses from your voice input. Edit or remove any
            before saving.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="mt-6">
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : (
          <div className="mt-4 space-y-4 pb-24">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No entries left. Close to start over.
              </p>
            )}
            {rows.map((r, idx) => {
              const cat = categoriesById.get(r.categoryId);
              const subs = cat?.subCategories ?? [];
              const hasSubs = subs.length > 0;
              return (
                <div
                  key={r.key}
                  className="rounded-xl border bg-card p-3 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Entry {idx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(r.key)}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={r.categoryId}
                      onValueChange={(v) =>
                        updateRow(r.key, { categoryId: v, subCategoryId: '' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span>{c.icon}</span>
                              <span>{c.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {r.categoryId && hasSubs && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sub-category</Label>
                      <Select
                        value={r.subCategoryId}
                        onValueChange={(v) => updateRow(r.key, { subCategoryId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-category" />
                        </SelectTrigger>
                        <SelectContent>
                          {subs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment mode</Label>
                    <Select
                      value={r.paymentModeId}
                      onValueChange={(v) => updateRow(r.key, { paymentModeId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentModes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Note</Label>
                    <Textarea
                      rows={2}
                      value={r.note}
                      onChange={(e) => updateRow(r.key, { note: e.target.value })}
                      maxLength={200}
                    />
                  </div>
                </div>
              );
            })}

            <div className="sticky bottom-0 -mx-6 border-t bg-background px-6 py-3">
              <Button
                onClick={handleSaveAll}
                disabled={!allValid || saving}
                className="w-full"
                size="lg"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save all{rows.length > 0 ? ` (${rows.length})` : ''}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}