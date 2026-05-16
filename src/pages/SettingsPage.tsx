import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Loader2, LogOut, Download } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getExpenses, getCategories, getPaymentModes, deleteExpense, updateExpense } from '@/lib/database';
import { Expense, Category, PaymentMode } from '@/types/expense';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CategoryManager } from '@/components/CategoryManager';
import { PaymentModeManager } from '@/components/PaymentModeManager';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState, ErrorState } from '@/components/LoadingError';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [exps, cats, modes] = await Promise.all([
        getExpenses(),
        getCategories(),
        getPaymentModes(),
      ]);
      setExpenses(exps);
      setCategories(cats);
      setPaymentModes(modes);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [categories]);

  const paymentModeMap = useMemo(() => {
    const map: Record<string, string> = {};
    paymentModes.forEach((pm) => {
      map[pm.id] = pm.name;
    });
    return map;
  }, [paymentModes]);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [expenses]);

  const getSubCategoryName = (expense: Expense): string => {
    const category = categoryMap[expense.categoryId];
    if (!category) return '';
    const subCat = category.subCategories.find((sc) => sc.id === expense.subCategoryId);
    return subCat?.name || '';
  };

  const getPaymentModeName = (expense: Expense): string => {
    return paymentModeMap[expense.paymentModeId] || expense.paymentModeId;
  };

  const selectedCategory = editForm.categoryId ? categoryMap[editForm.categoryId] : null;
  const subCategories = selectedCategory?.subCategories || [];

  const openEditSheet = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditForm({
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId,
      subCategoryId: expense.subCategoryId,
      paymentModeId: expense.paymentModeId,
      notes: expense.notes,
    });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!selectedExpense) return;
    
    if (!editForm.amount || editForm.amount <= 0) {
      toast({ title: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    if (!editForm.categoryId) {
      toast({ title: 'Please select a category', variant: 'destructive' });
      return;
    }
    if (!editForm.subCategoryId) {
      toast({ title: 'Please select a sub-category', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await updateExpense(selectedExpense.id, editForm);
      await loadData();
      setIsSheetOpen(false);
      toast({ title: 'Transaction updated' });
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      await loadData();
      setIsSheetOpen(false);
      toast({ title: 'Transaction deleted' });
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categoryMap[categoryId];
    setEditForm({
      ...editForm,
      categoryId,
      subCategoryId: category?.subCategories[0]?.id || '',
    });
  };

  const refreshCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to refresh categories:', error);
    }
  };

  const refreshPaymentModes = async () => {
    try {
      const modes = await getPaymentModes();
      setPaymentModes(modes);
    } catch (error) {
      console.error('Failed to refresh payment modes:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <AppLayout>
        <LoadingState className="py-20" />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="pt-6">
          <h1 className="text-xl font-semibold mb-4">Settings</h1>
          <ErrorState message={error} onRetry={loadData} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 pb-6">
        <div className="pt-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">Settings</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-muted text-muted-foreground">
                Beta
              </span>
            </div>
            {user?.email && (
              <p className="text-sm text-muted-foreground">{user.email}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="categories" onClick={refreshCategories}>Categories</TabsTrigger>
            <TabsTrigger value="payment-modes" onClick={refreshPaymentModes}>Payment Modes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              {sortedExpenses.length} expense{sortedExpenses.length !== 1 ? 's' : ''} recorded
            </p>

            {sortedExpenses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-sm text-muted-foreground">Add your first expense to see it here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sortedExpenses.map((expense) => {
                  const category = categoryMap[expense.categoryId];
                  const subCategoryName = getSubCategoryName(expense);

                  return (
                    <Card 
                      key={expense.id} 
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => openEditSheet(expense)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                            {category?.icon || '📦'}
                          </div>
                          <div>
                            <p className="font-medium">{category?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {subCategoryName && `${subCategoryName} · `}
                              {getPaymentModeName(expense)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(expense.date), 'd MMM yyyy')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="payment-modes" className="mt-4">
            <PaymentModeManager />
          </TabsContent>
        </Tabs>

        {/* Version info */}
        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Version 0.1.0
          </p>
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={editForm.amount || ''}
                onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {editForm.date ? format(parseISO(editForm.date), 'd MMM yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={editForm.date ? parseISO(editForm.date) : undefined}
                    onSelect={(date) => date && setEditForm({ ...editForm, date: format(date, 'yyyy-MM-dd') })}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editForm.categoryId || ''} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-category */}
            <div className="space-y-2">
              <Label>Sub-category</Label>
              <Select 
                value={editForm.subCategoryId || ''} 
                onValueChange={(v) => setEditForm({ ...editForm, subCategoryId: v })}
                disabled={subCategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-category" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {subCategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select 
                value={editForm.paymentModeId || ''} 
                onValueChange={(v) => setEditForm({ ...editForm, paymentModeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment mode" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {paymentModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add notes"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this transaction. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => selectedExpense && handleDelete(selectedExpense.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
