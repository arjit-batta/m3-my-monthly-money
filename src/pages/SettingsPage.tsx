import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getExpenses, getCategories } from '@/lib/storage';
import { Expense, Category } from '@/types/expense';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaymentModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
  };
  return labels[mode] || mode;
}

export default function SettingsPage() {
  const expenses = getExpenses();
  const categories = getCategories();

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [categories]);

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

  return (
    <AppLayout>
      <div className="space-y-4 pb-6">
        <div className="pt-6">
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {sortedExpenses.length} expense{sortedExpenses.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

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
                <Card key={expense.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                        {category?.icon || '📦'}
                      </div>
                      <div>
                        <p className="font-medium">{category?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {subCategoryName && `${subCategoryName} · `}
                          {getPaymentModeLabel(expense.paymentMode)}
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
      </div>
    </AppLayout>
  );
}
