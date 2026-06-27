import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { getSubscriptions, Subscription } from '@/lib/subscriptions';
import { confirmRenewal, dismissRenewal, isDueToday } from '@/lib/renewalPrompts';
import { queryClient } from '@/App';

export function RenewalPrompts() {
  const { user, loading } = useAuth();
  const [queue, setQueue] = useState<Subscription[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  // Load due subscriptions once per session/user.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const subs = await getSubscriptions();
        const due = subs.filter((s) => isDueToday(s));
        if (!cancelled) setQueue(due);
      } catch (err) {
        console.error('Failed to load subscription renewals', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  // Drive the queue: when nothing is showing, pop the next item.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  const advance = useCallback(() => {
    setCurrent(null);
    setQueue((prev) => prev.slice(1));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      await confirmRenewal(current);
      toast({ title: 'Logged as expense', description: current.name });
      queryClient.invalidateQueries();
      advance();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not log expense',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }, [current, advance]);

  const handleDismiss = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      await dismissRenewal(current);
      queryClient.invalidateQueries();
      advance();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not update subscription',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }, [current, advance]);

  if (!current) return null;

  const dateLabel = (() => {
    try {
      return format(parseISO(current.nextRenewalDate), 'PPP');
    } catch {
      return current.nextRenewalDate;
    }
  })();

  return (
    <AlertDialog open={!!current}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current.name} renewed</AlertDialogTitle>
          <AlertDialogDescription>
            {current.name} renewed on {dateLabel} — log it as an expense?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={handleDismiss}>
            No, skip
          </AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={handleConfirm}>
            Yes, log it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}