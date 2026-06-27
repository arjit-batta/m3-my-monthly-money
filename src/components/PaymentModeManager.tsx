import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { getPaymentModes, addPaymentMode, updatePaymentMode, deletePaymentMode, getExpenses } from '@/lib/database';
import { PaymentMode, PaymentModeType, Expense } from '@/types/expense';
import { toast } from '@/hooks/use-toast';
import { LoadingState, ErrorState } from '@/components/LoadingError';
import { withErrorHandling } from '@/lib/db-utils';
import { CardStrategyEditor } from '@/components/CardStrategyEditor';
import { CardStrategyFields } from '@/components/CardStrategyFields';
import { CardStrategyInput, upsertCardStrategy } from '@/lib/cardStrategies';

const PAYMENT_MODE_TYPES: { value: PaymentModeType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function PaymentModeManager() {
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<PaymentMode | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentModeType | ''>('');
  const defaultStrategy: CardStrategyInput = {
    tags: [],
    keepAlive: false,
    keepAliveCadenceDays: 30,
    note: null,
  };
  const [strategyDraft, setStrategyDraft] = useState<CardStrategyInput>(defaultStrategy);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [modes, exps] = await Promise.all([
        getPaymentModes(),
        getExpenses(),
      ]);
      setPaymentModes(modes);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load payment modes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment modes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setName('');
    setType('');
    setStrategyDraft(defaultStrategy);
  };

  const openAddSheet = () => {
    resetForm();
    setIsAddSheetOpen(true);
  };

  const openEditSheet = (mode: PaymentMode) => {
    setEditingMode(mode);
    setName(mode.name);
    setType(mode.type || '');
    setIsEditSheetOpen(true);
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const result = await withErrorHandling(() => addPaymentMode({
      name: name.trim(),
      type: type || undefined,
    }));
    
    if (result.success === true) {
      const newId = (result as { success: true; data: string }).data;
      if (type === 'credit_card') {
        const hasStrategyData =
          strategyDraft.tags.length > 0 ||
          strategyDraft.keepAlive ||
          (strategyDraft.note?.trim().length ?? 0) > 0;
        if (hasStrategyData) {
          try {
            await upsertCardStrategy(newId, {
              ...strategyDraft,
              keepAliveCadenceDays: strategyDraft.keepAlive
                ? Math.max(1, strategyDraft.keepAliveCadenceDays || 30)
                : 30,
              note: strategyDraft.note?.trim() ? strategyDraft.note.trim() : null,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            toast({ title: 'Payment mode added, but strategy failed', description: message, variant: 'destructive' });
          }
        }
      }
      setSaving(false);
      await loadData();
      setIsAddSheetOpen(false);
      resetForm();
      toast({ title: 'Payment mode added' });
    } else {
      setSaving(false);
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to add payment mode',
        description: failedResult.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingMode) return;
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const result = await withErrorHandling(() => updatePaymentMode(editingMode.id, {
      name: name.trim(),
      type: type || undefined,
    }));
    
    setSaving(false);

    if (result.success === true) {
      await loadData();
      setIsEditSheetOpen(false);
      setEditingMode(null);
      resetForm();
      toast({ title: 'Payment mode updated' });
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to update payment mode',
        description: failedResult.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  const getModeDependencies = (modeId: string) => {
    const expenseCount = expenses.filter(e => e.paymentModeId === modeId).length;
    return { expenseCount };
  };

  const handleDelete = async (modeId: string) => {
    const result = await withErrorHandling(() => deletePaymentMode(modeId));
    
    if (result.success === true) {
      await loadData();
      setIsEditSheetOpen(false);
      setEditingMode(null);
      toast({ title: 'Payment mode deleted' });
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to delete payment mode',
        description: failedResult.error,
        variant: 'destructive' 
      });
    }
  };

  const getTypeLabel = (type?: PaymentModeType) => {
    if (!type) return null;
    const found = PAYMENT_MODE_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {paymentModes.length} payment mode{paymentModes.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={openAddSheet} className="gap-1">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {paymentModes.map((mode) => {
          const { expenseCount } = getModeDependencies(mode.id);
          const hasDependencies = expenseCount > 0;

          return (
            <Card key={mode.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{mode.name}</p>
                  {mode.type && (
                    <p className="text-xs text-muted-foreground">{getTypeLabel(mode.type)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEditSheet(mode)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {hasDependencies ? 'Cannot Delete' : `Delete "${mode.name}"?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {hasDependencies ? (
                            <>
                              This payment mode is used by <span className="font-semibold">{expenseCount} expense{expenseCount !== 1 ? 's' : ''}</span>.
                              Please reassign or delete those expenses first before removing this payment mode.
                            </>
                          ) : (
                            'This action cannot be undone.'
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        {hasDependencies ? (
                          <AlertDialogCancel>OK</AlertDialogCancel>
                        ) : (
                          <>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(mode.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Add Payment Mode</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Axis Bank Card"
              />
            </div>
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Select value={type} onValueChange={(v) => setType(v as PaymentModeType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {PAYMENT_MODE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Payment Mode
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Payment Mode</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Axis Bank Card"
              />
            </div>
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Select value={type} onValueChange={(v) => setType(v as PaymentModeType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {PAYMENT_MODE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            {editingMode && type === 'credit_card' && (
              <CardStrategyEditor paymentModeId={editingMode.id} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
