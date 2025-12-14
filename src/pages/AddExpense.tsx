import { AppLayout } from '@/components/AppLayout';

export default function AddExpense() {
  return (
    <AppLayout>
      <div className="py-6">
        <h1 className="text-xl font-semibold">Add Expense</h1>
        <p className="mt-2 text-muted-foreground">Record a new expense</p>
      </div>
    </AppLayout>
  );
}
