import { useState, useEffect, useCallback } from 'react';
import { getCategories, getExpenses, getBudgets, ensureBudgetsForMonth } from '@/lib/database';
import { CategorySpending, SubCategorySpending } from '@/types/expense';

export function useBudgetData(month: number, year: number, refreshKey: number = 0) {
  const [data, setData] = useState<{
    categories: CategorySpending[];
    totalBudget: number;
    totalSpent: number;
    remaining: number;
  }>({
    categories: [],
    totalBudget: 0,
    totalSpent: 0,
    remaining: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Auto-copy previous month's budgets into this month if none exist yet.
      try {
        await ensureBudgetsForMonth(month, year);
      } catch (initErr) {
        // Non-fatal: log and continue rendering with whatever exists.
        console.warn('Budget initialization skipped:', initErr);
      }

      const [categories, expenses, budgets] = await Promise.all([
        getCategories(),
        getExpenses(),
        getBudgets(),
      ]);

      // Filter expenses for the current month/year
      const monthlyExpenses = expenses.filter((e) => {
        const [expYear, expMonth] = e.date.split('-').map(Number);
        return expMonth === month && expYear === year;
      });

      // Build category spending data
      const categorySpending: CategorySpending[] = categories.map((category) => {
        const subCategoryData: SubCategorySpending[] = category.subCategories.map((sub) => {
          // Find budget for this sub-category
          const budget = budgets.find(
            (b) =>
              b.categoryId === category.id &&
              b.subCategoryId === sub.id &&
              b.month === month &&
              b.year === year
          );
          const budgetAmount = budget?.amount || 0;

          // Calculate spent amount
          const spent = monthlyExpenses
            .filter((e) => e.categoryId === category.id && e.subCategoryId === sub.id)
            .reduce((sum, e) => sum + e.amount, 0);

          const remaining = budgetAmount - spent;
          const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

          return {
            subCategoryId: sub.id,
            subCategoryName: sub.name,
            budget: budgetAmount,
            spent,
            remaining,
            percentage,
          };
        });

        const totalBudget = subCategoryData.reduce((sum, sc) => sum + sc.budget, 0);
        const totalSpent = subCategoryData.reduce((sum, sc) => sum + sc.spent, 0);
        const remaining = totalBudget - totalSpent;
        const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        return {
          categoryId: category.id,
          categoryName: category.name,
          icon: category.icon,
          color: category.color,
          totalBudget,
          totalSpent,
          remaining,
          percentage,
          subCategories: subCategoryData,
        };
      });

      const totalBudget = categorySpending.reduce((sum, c) => sum + c.totalBudget, 0);
      const totalSpent = categorySpending.reduce((sum, c) => sum + c.totalSpent, 0);

      setData({
        categories: categorySpending,
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
      });
    } catch (err) {
      console.error('Failed to fetch budget data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData, refreshKey]);

  return { ...data, loading, error, refetch: fetchData };
}
