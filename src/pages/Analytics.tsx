import { AppLayout } from '@/components/AppLayout';

export default function Analytics() {
  return (
    <AppLayout>
      <div className="py-6">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-2 text-muted-foreground">View spending insights</p>
      </div>
    </AppLayout>
  );
}
