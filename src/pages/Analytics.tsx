import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBudgetData } from '@/hooks/useBudgetData';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

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
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Prepare chart data - only categories with spending
  const chartData = categories
    .filter((c) => c.totalSpent > 0)
    .map((c, index) => ({
      name: c.categoryName,
      value: c.totalSpent,
      icon: c.icon,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

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
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Left</p>
              <p className={`text-lg font-bold ${getStatusColor(percentage, totalBudget > 0)}`}>
                {formatCurrency(remaining)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {chartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.icon} {item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget vs Spent Comparison */}
        {categories.some((c) => c.totalBudget > 0 || c.totalSpent > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget vs Spent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categories
                .filter((c) => c.totalBudget > 0 || c.totalSpent > 0)
                .map((category) => {
                  const isOver = category.totalSpent > category.totalBudget && category.totalBudget > 0;
                  const barMax = Math.max(category.totalBudget, category.totalSpent);
                  const budgetWidth = barMax > 0 ? (category.totalBudget / barMax) * 100 : 0;
                  const spentWidth = barMax > 0 ? (category.totalSpent / barMax) * 100 : 0;

                  return (
                    <div key={category.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {category.icon} {category.categoryName}
                        </span>
                        {isOver && (
                          <span className="text-xs font-medium text-destructive">
                            Over by {formatCurrency(category.totalSpent - category.totalBudget)}
                          </span>
                        )}
                      </div>
                      <div className="relative h-6 rounded-md bg-muted">
                        {/* Budget bar (background) */}
                        {category.totalBudget > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-md bg-primary/20"
                            style={{ width: `${budgetWidth}%` }}
                          />
                        )}
                        {/* Spent bar (foreground) */}
                        <div
                          className={`absolute inset-y-0 left-0 rounded-md transition-all ${
                            isOver ? 'bg-destructive' : category.percentage >= 75 ? 'bg-orange-500' : 'bg-green-600'
                          }`}
                          style={{ width: `${spentWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Spent: {formatCurrency(category.totalSpent)}</span>
                        <span>Budget: {formatCurrency(category.totalBudget)}</span>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}

        {totalSpent === 0 && totalBudget === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No expenses or budgets recorded for this month.
          </p>
        )}
      </div>
    </AppLayout>
  );
}