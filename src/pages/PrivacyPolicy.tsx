import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <div className="space-y-4 pb-6">
        <div className="pt-6 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Privacy Policy</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Privacy Policy content coming soon.
        </p>
      </div>
    </AppLayout>
  );
}