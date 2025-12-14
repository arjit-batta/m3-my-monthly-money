import { AppLayout } from '@/components/AppLayout';

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="py-6">
        <h1 className="text-xl font-semibold">Settings & Transactions</h1>
        <p className="mt-2 text-muted-foreground">Manage categories and view history</p>
      </div>
    </AppLayout>
  );
}
