import { useMemo } from 'react';
import { getCategories, getExpenses, getBudgets } from '@/lib/storage';
import { CategorySpending, SubCategorySpending } from '@/types/expense';

export function useBudgetData(month: number, year: number, refreshKey: number = 0) {
  return useMemo(() => {
    const categories = getCategories();
    const expenses = getExpenses();
    const budgets = getBudgets();

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

    return {
      categories: categorySpending,
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
    };
  }, [month, year, refreshKey]);
}
