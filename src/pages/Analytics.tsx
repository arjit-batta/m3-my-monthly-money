import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBudgetData } from '@/hooks/useBudgetData';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(percentage: number, hasBudget: boolean): string {
  if (!hasBudget) return 'text-muted-foreground';
  if (percentage >= 100) return 'text-destructive';
  if (percentage >= 75) return 'text-orange-500';
  return 'text-green-600';
}

export default function Analytics() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { totalBudget, totalSpent, remaining } = useBudgetData(month, year);

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
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const isOverBudget = remaining < 0;

  return (
    <AppLayout>
      <div className="space-y-6 pb-6">
        {/* Header with month navigation */}
        <div className="flex items-center justify-between pt-6">
          <h1 className="text-xl font-semibold">Analytics</h1>
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

        {/* Summary Cards */}
        <div className="grid gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-2xl font-bold ${getStatusColor(percentage, totalBudget > 0)}`}>
                {formatCurrency(remaining)}
              </p>
              {totalBudget > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {percentage.toFixed(0)}% of budget used
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {totalBudget === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No budgets set for this month. Add budgets to track your spending.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
