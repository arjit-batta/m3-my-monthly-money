import { useState, useCallback, useMemo } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BudgetCard } from '@/components/BudgetCard';
import { BudgetEditor } from '@/components/BudgetEditor';
import { useBudgetData } from '@/hooks/useBudgetData';
import { LoadingState, ErrorState, EmptyState } from '@/components/LoadingError';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Budgets() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [refreshKey, setRefreshKey] = useState(0);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSubCategoryId, setEditSubCategoryId] = useState('');
  const [editAmount, setEditAmount] = useState(0);

  const { categories, totalBudget, totalSpent, remaining, loading, error, refetch } = useBudgetData(month, year, refreshKey);

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleAddBudget = () => {
    setEditCategoryId('');
    setEditSubCategoryId('');
    setEditAmount(0);
    setEditorOpen(true);
  };

  const handleEditBudget = useCallback((categoryId: string, subCategoryId: string, currentAmount: number) => {
    setEditCategoryId(categoryId);
    setEditSubCategoryId(subCategoryId);
    setEditAmount(currentAmount);
    setEditorOpen(true);
  }, []);

  const handleBudgetSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy');

  // Calculate month progress
  const monthProgress = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;
    
    if (!isCurrentMonth) {
      // If viewing a past month, it's 100% complete; future month is 0%
      const selectedDate = new Date(year, month - 1);
      if (selectedDate < new Date(today.getFullYear(), today.getMonth())) {
        return 100;
      }
      return 0;
    }
    
    const currentDay = today.getDate();
    const totalDays = getDaysInMonth(new Date(year, month - 1));
    return Math.round((currentDay / totalDays) * 100);
  }, [month, year]);
  const isOverBudget = remaining < 0;

  return (
    <AppLayout>
      <div className="space-y-6 pb-6">
        {/* Header with month navigation */}
        <div className="flex items-center justify-between pt-6">
          <h1 className="text-xl font-semibold">Budgets</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Error state */}
        {error && !loading && (
          <ErrorState message={error} onRetry={refetch} />
        )}

        {/* Loading state */}
        {loading && <LoadingState />}

        {/* Content when loaded successfully */}
        {!loading && !error && (
          <>
            {/* Month Progress Indicator */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {monthLabel} • {monthProgress}% of month completed
                </span>
              </div>
              <Progress 
                value={monthProgress} 
                className="h-2 bg-muted [&>div]:bg-muted-foreground/50"
              />
            </div>

            {/* Summary card */}
            <div className="rounded-xl bg-primary/10 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-lg font-semibold">{formatCurrency(totalBudget)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="text-lg font-semibold">{formatCurrency(totalSpent)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className={`text-lg font-semibold ${isOverBudget ? 'text-destructive' : ''}`}>
                    {formatCurrency(remaining)}
                  </p>
                </div>
              </div>
            </div>

            {/* Add budget button */}
            <Button onClick={handleAddBudget} className="w-full" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Budget
            </Button>

            {/* Category cards */}
            {categories.length > 0 ? (
              <div className="space-y-3">
                {categories.map((category) => (
                  <BudgetCard
                    key={`${category.categoryId}-${refreshKey}`}
                    category={category}
                    onEditBudget={handleEditBudget}
                  />
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No categories found" 
                description="Add categories in Settings to start budgeting" 
              />
            )}
          </>
        )}
      </div>

      <BudgetEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        month={month}
        year={year}
        initialCategoryId={editCategoryId}
        initialSubCategoryId={editSubCategoryId}
        initialAmount={editAmount}
        onSave={handleBudgetSaved}
      />
    </AppLayout>
  );
}
