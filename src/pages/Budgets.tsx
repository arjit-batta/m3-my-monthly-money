import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { BudgetCard } from '@/components/BudgetCard';
import { useBudgetData } from '@/hooks/useBudgetData';

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

  const { categories, totalBudget, totalSpent, remaining } = useBudgetData(month, year);

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

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy');
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

        {/* Category cards */}
        <div className="space-y-3">
          {categories.map((category) => (
            <BudgetCard key={category.categoryId} category={category} />
          ))}
        </div>

        {categories.length === 0 && (
          <p className="text-center text-muted-foreground">No categories found</p>
        )}
      </div>
    </AppLayout>
  );
}
