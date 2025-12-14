import { AppLayout } from '@/components/AppLayout';
import { ExpenseForm } from '@/components/ExpenseForm';

export default function AddExpense() {
  return (
    <AppLayout>
      <div className="py-6">
        <h1 className="text-2xl font-semibold">Add Expense</h1>
        <p className="mt-1 text-sm text-muted-foreground">Record a new transaction</p>
      </div>
      <ExpenseForm />
    </AppLayout>
  );
}
