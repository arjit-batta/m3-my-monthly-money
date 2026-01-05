import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { getPaymentModes, addPaymentMode, updatePaymentMode, deletePaymentMode, getExpenses, generateId } from '@/lib/storage';
import { PaymentMode, PaymentModeType } from '@/types/expense';
import { toast } from '@/hooks/use-toast';

const PAYMENT_MODE_TYPES: { value: PaymentModeType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function PaymentModeManager() {
  const [paymentModes, setPaymentModes] = useState(getPaymentModes);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<PaymentMode | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentModeType | ''>('');

  const refreshPaymentModes = () => {
    setPaymentModes(getPaymentModes());
  };

  const resetForm = () => {
    setName('');
    setType('');
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

  const handleAdd = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const newMode: PaymentMode = {
      id: generateId(),
      name: name.trim(),
      type: type || undefined,
    };

    addPaymentMode(newMode);
    refreshPaymentModes();
    setIsAddSheetOpen(false);
    resetForm();
    toast({ title: 'Payment mode added' });
  };

  const handleUpdate = () => {
    if (!editingMode) return;
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    updatePaymentMode(editingMode.id, {
      name: name.trim(),
      type: type || undefined,
    });
    refreshPaymentModes();
    setIsEditSheetOpen(false);
    setEditingMode(null);
    resetForm();
    toast({ title: 'Payment mode updated' });
  };

  const getModeDependencies = (modeId: string) => {
    const expenses = getExpenses();
    const expenseCount = expenses.filter(e => e.paymentModeId === modeId).length;
    return { expenseCount };
  };

  const handleDelete = (modeId: string) => {
    deletePaymentMode(modeId);
    refreshPaymentModes();
    setIsEditSheetOpen(false);
    setEditingMode(null);
    toast({ title: 'Payment mode deleted' });
  };

  const getTypeLabel = (type?: PaymentModeType) => {
    if (!type) return null;
    const found = PAYMENT_MODE_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

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
            <Button onClick={handleAdd} className="w-full">
              Add Payment Mode
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
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
            <Button onClick={handleUpdate} className="w-full">
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
