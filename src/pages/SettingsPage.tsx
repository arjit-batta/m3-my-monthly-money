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
import { getExpenses, getCategories, getPaymentModes, getBudgets, deleteExpense, updateExpense } from '@/lib/database';
import { Expense, Category, PaymentMode, Budget } from '@/types/expense';
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
  const [exportMonth, setExportMonth] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [exportingBudget, setExportingBudget] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [exps, cats, modes, buds] = await Promise.all([
        getExpenses(),
        getCategories(),
        getPaymentModes(),
        getBudgets(),
      ]);
      setExpenses(exps);
      setCategories(cats);
      setPaymentModes(modes);
      setBudgets(buds);
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

  // CSV Export helpers
  const escapeCsvField = (field: unknown): string => {
    const str = field == null ? '' : String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  function formatPercentage(value: unknown): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const rounded = Math.round(num * 10) / 10;
    const formatted = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
    return `${formatted}%`;
  }

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    expenses.forEach((exp) => {
      const d = parseISO(exp.date);
      monthSet.add(format(d, 'yyyy-MM'));
    });
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const expensesForExportMonth = useMemo(() => {
    if (!exportMonth) return [];
    return expenses
      .filter((exp) => exp.date.startsWith(exportMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, exportMonth]);

  const handleExportCsv = async () => {
    if (expensesForExportMonth.length === 0 || exporting) return;
    setExporting(true);

    try {
    const headers = ['Date', 'Category', 'Sub-category', 'Amount', 'Payment Mode', 'Notes'];
    const rows = expensesForExportMonth.map((exp) => {
      const category = categoryMap[exp.categoryId];
      const subCat = category?.subCategories.find((sc) => sc.id === exp.subCategoryId);
      return [
        format(parseISO(exp.date), 'dd MMM yyyy'),
        category?.name || 'Unknown',
        subCat?.name || '',
        exp.amount,
        getPaymentModeName(exp),
        exp.notes,
      ];
    });

    const csvLines = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ];
    const csvContent = '\ufeff' + csvLines.join('\n');
    const fileName = `expenses-${exportMonth}.csv`;
    const count = expensesForExportMonth.length;
    const successMsg = `Exported ${count} expense${count !== 1 ? 's' : ''}`;
    await shareOrDownloadCsv(csvContent, fileName, `Expenses for ${format(parseISO(`${exportMonth}-01`), 'MMMM yyyy')}`, successMsg);
    } catch (err) {
      console.error('Export failed:', err);
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Shared share/download helper — reused by expense + budget exports
  const shareOrDownloadCsv = async (
    csvContent: string,
    fileName: string,
    shareText: string,
    successMsg: string,
  ) => {
    const mimeType = 'text/csv';
    const blob = new Blob([csvContent], { type: `${mimeType};charset=utf-8;` });

    try {
      const file = new File([blob], fileName, { type: mimeType });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: fileName, text: shareText });
        toast({ title: successMsg });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('Share failed, falling back to download:', err);
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: successMsg });
  };

  // Budget summary export
  const budgetSummaryForMonth = useMemo(() => {
    if (!exportMonth) return [] as Array<{ category: string; subCategory: string; budget: number; spent: number; remaining: number; percentage: number; isCategoryRow: boolean }>;
    const [yStr, mStr] = exportMonth.split('-');
    const year = Number(yStr);
    const month = Number(mStr);

    const monthlyExpenses = expenses.filter((e) => e.date.startsWith(exportMonth));

    const rows: Array<{ category: string; subCategory: string; budget: number; spent: number; remaining: number; percentage: number; isCategoryRow: boolean }> = [];

    categories.forEach((category) => {
      const subRows = category.subCategories.map((sub) => {
        const budget = budgets.find(
          (b) => b.categoryId === category.id && b.subCategoryId === sub.id && b.month === month && b.year === year,
        );
        const budgetAmount = budget?.amount || 0;
        const spent = monthlyExpenses
          .filter((e) => e.categoryId === category.id && e.subCategoryId === sub.id)
          .reduce((sum, e) => sum + e.amount, 0);
        const remaining = budgetAmount - spent;
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        return {
          category: category.name,
          subCategory: sub.name,
          budget: budgetAmount,
          spent,
          remaining,
          percentage,
          isCategoryRow: false,
        };
      });

      const totalBudget = subRows.reduce((s, r) => s + r.budget, 0);
      const totalSpent = subRows.reduce((s, r) => s + r.spent, 0);
      const totalRemaining = totalBudget - totalSpent;
      const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      // Skip categories with no budget AND no spend at all
      if (totalBudget === 0 && totalSpent === 0) return;

      rows.push({
        category: category.name,
        subCategory: '',
        budget: totalBudget,
        spent: totalSpent,
        remaining: totalRemaining,
        percentage: totalPct,
        isCategoryRow: true,
      });
      subRows.forEach((r) => {
        if (r.budget === 0 && r.spent === 0) return;
        rows.push(r);
      });
    });

    return rows;
  }, [exportMonth, expenses, budgets, categories]);

  const handleExportBudgetCsv = async () => {
    if (budgetSummaryForMonth.length === 0 || exportingBudget) return;
    setExportingBudget(true);

    try {
      const headers = ['Category', 'Sub-category', 'Budget Amount', 'Spent Amount', 'Remaining Amount', 'Percentage Used'];
      const rows = budgetSummaryForMonth.map((r) => [
        r.category,
        r.subCategory,
        r.budget.toFixed(2),
        r.spent.toFixed(2),
        r.remaining.toFixed(2),
        r.percentage.toFixed(2),
      ]);
      const csvLines = [
        headers.map(escapeCsvField).join(','),
        ...rows.map((row) => row.map(escapeCsvField).join(',')),
      ];
      const csvContent = '\ufeff' + csvLines.join('\n');
      const fileName = `budget-summary-${exportMonth}.csv`;
      const monthLabel = format(parseISO(`${exportMonth}-01`), 'MMMM yyyy');
      await shareOrDownloadCsv(csvContent, fileName, `Budget summary for ${monthLabel}`, 'Budget summary exported');
    } catch (err) {
      console.error('Budget export failed:', err);
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setExportingBudget(false);
    }
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

        {/* Reports & Export */}
        <div className="pt-2">
          <h2 className="text-base font-semibold mb-3">Reports & Export</h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={exportMonth}
                  onValueChange={setExportMonth}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {availableMonths.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No expense data available
                      </SelectItem>
                    ) : (
                      availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>
                          {format(parseISO(`${m}-01`), 'MMMM yyyy')}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {exportMonth && expensesForExportMonth.length === 0 && (
                <p className="text-sm text-muted-foreground">No expenses for this month</p>
              )}

              <Button
                onClick={handleExportCsv}
                disabled={expensesForExportMonth.length === 0 || exporting}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Expenses CSV
                  </>
                )}
              </Button>

              {exportMonth && budgetSummaryForMonth.length === 0 && (
                <p className="text-sm text-muted-foreground">No budget data for this month</p>
              )}

              <Button
                onClick={handleExportBudgetCsv}
                disabled={budgetSummaryForMonth.length === 0 || exportingBudget}
                variant="outline"
                className="w-full"
              >
                {exportingBudget ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Budget Summary CSV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

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
