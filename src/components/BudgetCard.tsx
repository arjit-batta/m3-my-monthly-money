import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CategorySpending } from '@/types/expense';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BudgetCardProps {
  category: CategorySpending;
  onEditBudget?: (categoryId: string, subCategoryId: string, currentAmount: number) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(percentage: number, hasBudget: boolean): string {
  if (!hasBudget) return '';
  if (percentage >= 100) return 'text-destructive';
  if (percentage >= 75) return 'text-orange-500';
  return 'text-green-600';
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return '[&>div]:bg-destructive';
  if (percentage >= 75) return '[&>div]:bg-orange-500';
  return '[&>div]:bg-green-600';
}

export function BudgetCard({ category, onEditBudget }: BudgetCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasSubsWithBudget = category.subCategories.some((sc) => sc.budget > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <CollapsibleTrigger className="w-full text-left">
          {/* Category header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <div>
                <p className="font-medium">{category.categoryName}</p>
                <p className="text-sm text-muted-foreground">
                  {category.subCategories.length} sub-categories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(category.totalSpent)}</p>
                {category.totalBudget > 0 && (
                  <p className="text-sm text-muted-foreground">
                    of {formatCurrency(category.totalBudget)}
                  </p>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Category percentage + progress bar */}
          {category.totalBudget > 0 && (
            <div className="mt-3">
              <p className={cn('text-sm font-medium mb-1', getStatusColor(category.percentage, true))}>
                {Math.round(category.percentage)}% used
              </p>
              <Progress
                value={Math.min(category.percentage, 100)}
                className={cn('h-2', getProgressColor(category.percentage))}
              />
            </div>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 space-y-4 border-t pt-4">
            {category.subCategories.map((sub) => (
              <div key={sub.subCategoryId} className="space-y-1">
                {/* Sub-category header row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{sub.subCategoryName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-sm font-medium">{formatCurrency(sub.spent)}</span>
                      {sub.budget > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {' '}/ {formatCurrency(sub.budget)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBudget?.(category.categoryId, sub.subCategoryId, sub.budget);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Sub-category percentage + progress bar */}
                {sub.budget > 0 && (
                  <div className="pl-0">
                    <p className={cn('text-xs font-medium mb-1', getStatusColor(sub.percentage, true))}>
                      {Math.round(sub.percentage)}% used
                    </p>
                    <Progress
                      value={Math.min(sub.percentage, 100)}
                      className={cn('h-1.5', getProgressColor(sub.percentage))}
                    />
                  </div>
                )}
              </div>
            ))}
            {!hasSubsWithBudget && (
              <p className="text-sm text-muted-foreground italic">No budgets set. Tap the pencil icon to add one.</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
