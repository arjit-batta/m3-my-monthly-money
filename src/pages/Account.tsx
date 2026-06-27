import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, KeyRound, FileText, ShieldCheck, Mail, Trash2, LogOut, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { getMyProfile } from '@/lib/profile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SUPPORT_EMAIL = 'support@placeholder.com'; // PLACEHOLDER — update later

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMyProfile().then((p) => setIsPremium(!!p?.isPremium)).catch(() => {});
  }, []);

  const initial = (user?.email?.[0] || '?').toUpperCase();

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const uid = user.id;
      // Delete in dependency order
      await supabase.from('expenses').delete().eq('user_id', uid);
      await supabase.from('budgets').delete().eq('user_id', uid);
      await supabase.from('subscriptions').delete().eq('user_id', uid);
      await supabase.from('card_strategies').delete().eq('user_id', uid);
      await supabase.from('sub_categories').delete().eq('user_id', uid);
      await supabase.from('categories').delete().eq('user_id', uid);
      await supabase.from('payment_modes').delete().eq('user_id', uid);
      await supabase.from('profiles').delete().eq('id', uid);
      toast({ title: 'Your data has been deleted' });
      await signOut();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Failed to delete data',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 pb-6">
        <div className="pt-6 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Account</h1>
        </div>

        <Card className="p-4 flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {isPremium ? 'Premium' : 'Free plan'}
            </p>
          </div>
        </Card>

        <Card className="divide-y">
          <button
            className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/60 transition-colors"
            onClick={() => navigate('/change-password')}
          >
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm">Change password</span>
            <span className="text-muted-foreground">›</span>
          </button>
          <Link
            to="/privacy"
            className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/60 transition-colors"
          >
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm">Privacy Policy</span>
            <span className="text-muted-foreground">›</span>
          </Link>
          <Link
            to="/terms"
            className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/60 transition-colors"
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm">Terms of Service</span>
            <span className="text-muted-foreground">›</span>
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/60 transition-colors"
          >
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm">Contact / Support</span>
            <span className="text-muted-foreground">›</span>
          </a>
          <button
            className="w-full flex items-center gap-3 p-4 text-left text-destructive active:bg-muted/60 transition-colors"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-5 w-5" />
            <span className="flex-1 text-sm">Delete my account & data</span>
          </button>
        </Card>

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-2">Version 0.1.0</p>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account & data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all your expenses, budgets, categories, payment modes,
              subscriptions, and card strategies. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}