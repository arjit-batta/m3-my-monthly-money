import { AppLayout } from '@/components/AppLayout';

export default function Budgets() {
  return (
    <AppLayout>
      <div className="py-6">
        <h1 className="text-xl font-semibold">Budgets</h1>
        <p className="mt-2 text-muted-foreground">Set monthly budget limits</p>
      </div>
    </AppLayout>
  );
}
