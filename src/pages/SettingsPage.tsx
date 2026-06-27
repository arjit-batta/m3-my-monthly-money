import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Loader2, Download } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getExpenses, getCategories, getPaymentModes, getBudgets } from '@/lib/database';
import { Expense, Category, PaymentMode, Budget } from '@/types/expense';
import { toast } from '@/hooks/use-toast';
import { CategoryManager } from '@/components/CategoryManager';
import { PaymentModeManager } from '@/components/PaymentModeManager';
import { useAuth } from '@/hooks/useAuth';
import { getMyProfile } from '@/lib/profile';
import { LoadingState, ErrorState } from '@/components/LoadingError';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    getMyProfile().then((p) => setIsPremium(!!p?.isPremium)).catch(() => {});
  }, []);

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
        formatPercentage(r.percentage),
      ]);
      const csvLines = [
        headers.map(escapeCsvField).join(','),
        ...rows.map((row) => row.map(escapeCsvField).join(',')),
      ];
      const csvContent = '\ufeff' + csvLines.join('\n');
      const fileName = `budget-summary-${exportMonth}.csv`;
      const monthLabel = format(parseISO(`${exportMonth}-01`), 'MMMM yyyy');
      const count = budgetSummaryForMonth.length;
      const successMsg = `Exported ${count} budget row${count !== 1 ? 's' : ''}`;
      await shareOrDownloadCsv(csvContent, fileName, `Budget summary for ${monthLabel}`, successMsg);
    } catch (err) {
      console.error('Budget export failed:', err);
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setExportingBudget(false);
    }
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
        <div className="pt-6 flex items-center gap-2">
          <h1 className="text-xl font-semibold">Settings</h1>
          <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-muted text-muted-foreground">
            Beta
          </span>
        </div>

        <button
          onClick={() => navigate('/account')}
          className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left active:bg-muted/60 transition-colors"
          aria-label="Open account"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {(user?.email?.[0] || '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email || 'Account'}</p>
            <p className="text-xs text-muted-foreground">{isPremium ? 'Premium' : 'Free plan'}</p>
          </div>
          <span className="text-muted-foreground text-lg leading-none">›</span>
        </button>

        <Tabs defaultValue="categories" className="w-full pt-2">
          <TabsList className="grid w-full grid-cols-3 gap-1">
            <TabsTrigger value="categories" onClick={refreshCategories}>Categories</TabsTrigger>
            <TabsTrigger value="payment-modes" onClick={refreshPaymentModes}>Payments</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="payment-modes" className="mt-4">
            <PaymentModeManager />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
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
                  <p className="text-sm text-muted-foreground">No expenses available for this month</p>
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
                  <p className="text-sm text-muted-foreground">No budget data available for this month</p>
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
          </TabsContent>
        </Tabs>

        {/* Version info */}
        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Version 0.1.0
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
