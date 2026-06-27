import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, CalendarIcon } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingState, ErrorState } from '@/components/LoadingError';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getCategories, getPaymentModes } from '@/lib/database';
import { Category, PaymentMode } from '@/types/expense';
import {
  Subscription,
  SubscriptionCadence,
  SubscriptionInput,
  SubscriptionSource,
  SubscriptionStatus,
  addSubscription,
  deleteSubscription,
  getSubscriptions,
  monthlyBurnFor,
  totalAnnualBurn,
  totalMonthlyBurn,
  updateSubscription,
} from '@/lib/subscriptions';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

const CADENCE_LABEL: Record<SubscriptionCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'app_store', label: 'App Store (Apple)' },
  { value: 'play_store', label: 'Play Store (Google)' },
  { value: 'upi_autopay', label: 'UPI Autopay' },
  { value: 'card_mandate', label: 'Card / bank mandate' },
  { value: 'provider', label: 'Provider app or website' },
  { value: 'other', label: 'Other' },
];
const SOURCE_KEYS = new Set(SOURCE_OPTIONS.map((o) => o.value));
const OTHER_VALUE = 'other';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

const emptyForm: SubscriptionInput = {
  name: '',
  amount: 0,
  cadence: 'monthly',
  nextRenewalDate: format(new Date(), 'yyyy-MM-dd'),
  paymentModeId: null,
  categoryId: null,
  source: 'card',
  status: 'active',
};

export function SubscriptionsView() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubscriptionInput>(emptyForm);
  const [otherSource, setOtherSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, c, p] = await Promise.all([getSubscriptions(), getCategories(), getPaymentModes()]);
      setSubs(s);
      setCategories(c);
      setPaymentModes(p);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paymentModeMap = useMemo(() => {
    const m: Record<string, string> = {};
    paymentModes.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [paymentModes]);

  const monthly = useMemo(() => totalMonthlyBurn(subs), [subs]);
  const annual = useMemo(() => totalAnnualBurn(subs), [subs]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, nextRenewalDate: format(new Date(), 'yyyy-MM-dd') });
    setOtherSource('');
    setSheetOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    const isKnown = SOURCE_KEYS.has(sub.source);
    setForm({
      name: sub.name,
      amount: sub.amount,
      cadence: sub.cadence,
      nextRenewalDate: sub.nextRenewalDate,
      paymentModeId: sub.paymentModeId,
      categoryId: sub.categoryId,
      source: isKnown ? sub.source : OTHER_VALUE,
      status: sub.status,
    });
    setOtherSource(isKnown ? '' : (sub.source || ''));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast({ title: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    if (!form.nextRenewalDate) {
      toast({ title: 'Next renewal date is required', variant: 'destructive' });
      return;
    }
    if (!form.paymentModeId) {
      toast({ title: '"Paid with" is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: SubscriptionInput = {
        ...form,
        source: form.source === OTHER_VALUE ? otherSource.trim() : form.source,
      };
      if (editingId) {
        await updateSubscription(editingId, payload);
        toast({ title: 'Subscription updated' });
      } else {
        await addSubscription(payload);
        toast({ title: 'Subscription added' });
      }
      setSheetOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSubscription(deleteId);
      toast({ title: 'Subscription deleted' });
      setDeleteId(null);
      setSheetOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (loading) {
    return <LoadingState className="py-20" />;
  }

  if (error) {
    return (
      <div>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Monthly burn</p>
                <p className="text-xl font-semibold">{formatCurrency(monthly)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual burn</p>
                <p className="text-xl font-semibold">{formatCurrency(annual)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              From {subs.filter((s) => s.status === 'active').length} active subscription
              {subs.filter((s) => s.status === 'active').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {subs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No subscriptions yet</p>
              <p className="text-sm text-muted-foreground">Tap Add to track your first one</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {subs.map((sub) => {
              const days = differenceInCalendarDays(parseISO(sub.nextRenewalDate), new Date());
              const renewsLabel =
                days < 0
                  ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
                  : days === 0
                    ? 'Renews today'
                    : `Renews in ${days} day${days === 1 ? '' : 's'}`;
              const pmName = sub.paymentModeId ? paymentModeMap[sub.paymentModeId] : null;
              return (
                <Card key={sub.id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => openEdit(sub)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{sub.name}</p>
                          {sub.status !== 'active' && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {STATUS_LABEL[sub.status]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {CADENCE_LABEL[sub.cadence]}
                          {pmName ? ` · ${pmName}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{renewsLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(sub.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          ≈ {formatCurrency(monthlyBurnFor(sub))}/mo
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit subscription' : 'Add subscription'}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Netflix"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-amount">Amount (₹)</Label>
                <Input
                  id="sub-amount"
                  type="number"
                  inputMode="decimal"
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cadence</Label>
                <Select
                  value={form.cadence}
                  onValueChange={(v) => setForm({ ...form, cadence: v as SubscriptionCadence })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CADENCE_LABEL) as SubscriptionCadence[]).map((c) => (
                      <SelectItem key={c} value={c}>{CADENCE_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Next renewal date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !form.nextRenewalDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.nextRenewalDate ? format(parseISO(form.nextRenewalDate), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.nextRenewalDate ? parseISO(form.nextRenewalDate) : undefined}
                    onSelect={(d) => d && setForm({ ...form, nextRenewalDate: format(d, 'yyyy-MM-dd') })}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Paid with <span className="text-destructive">*</span></Label>
              <Select
                value={form.paymentModeId ?? ''}
                onValueChange={(v) => setForm({ ...form, paymentModeId: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select a card / account" /></SelectTrigger>
                <SelectContent>
                  {paymentModes.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">The card or account the money comes from.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Manage / cancel via (optional)</Label>
              <Select
                value={form.source || ''}
                onValueChange={(v) => setForm({ ...form, source: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.source === OTHER_VALUE && (
                <Input
                  value={otherSource}
                  onChange={(e) => setOtherSource(e.target.value)}
                  placeholder="e.g. Email support, dealer, etc."
                />
              )}
              <p className="text-xs text-muted-foreground">
                Where you go to change or cancel this — e.g. App Store, Play Store, UPI Autopay, or the provider's website.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Select
                value={form.categoryId ?? 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as SubscriptionStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? (<><Pencil className="mr-1 h-4 w-4" /> Save</>) : (<><Plus className="mr-1 h-4 w-4" /> Add</>)}
              </Button>
              {editingId && (
                <Button variant="destructive" onClick={() => setDeleteId(editingId)} disabled={saving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subscription?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <AppLayout>
      <div className="pt-6">
        <h1 className="text-xl font-semibold mb-4">Subscriptions</h1>
        <SubscriptionsView />
      </div>
    </AppLayout>
  );
}