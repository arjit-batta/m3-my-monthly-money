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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { getSubscriptions, Subscription } from '@/lib/subscriptions';
import {
  advanceSubscription,
  dismissRenewal,
  isDueToday,
  resolveSubscriptionCategoryId,
} from '@/lib/renewalPrompts';
import { queryClient } from '@/App';
import {
  ExpenseForm,
  type ExpenseFormInitialValues,
} from '@/components/ExpenseForm';

export function RenewalPrompts() {
  const { user, loading } = useAuth();
  const [queue, setQueue] = useState<Subscription[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{
    sub: Subscription;
    initial: ExpenseFormInitialValues;
  } | null>(null);

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
    if (!current.paymentModeId) {
      toast({
        title: 'Missing payment mode',
        description: 'Set a "Paid with" payment mode on this subscription first.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const categoryId = await resolveSubscriptionCategoryId(current);
      const initial: ExpenseFormInitialValues = {
        amount: current.amount,
        date: parseISO(current.nextRenewalDate),
        categoryId,
        // sub-category intentionally left empty for the user
        paymentModeId: current.paymentModeId,
        notes: `${current.name} (subscription)`,
      };
      setEditing({ sub: current, initial });
      setCurrent(null); // close the alert; keep this item out of the queue
      setQueue((prev) => prev.slice(1));
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not open expense form',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }, [current]);

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

  const handleSaved = useCallback(async () => {
    if (!editing) return;
    try {
      await advanceSubscription(editing.sub);
    } catch (err) {
      console.error('Failed to advance subscription after save', err);
    }
    setEditing(null);
    queryClient.invalidateQueries();
  }, [editing]);

  const dateLabel = current
    ? (() => {
        try {
          return format(parseISO(current.nextRenewalDate), 'PPP');
        } catch {
          return current.nextRenewalDate;
        }
      })()
    : '';

  return (
    <>
      {current && (
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
      )}

      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
          {editing && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>Log {editing.sub.name} renewal</SheetTitle>
                <SheetDescription>
                  Review and adjust before saving. Close to skip — the subscription
                  will prompt again later.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <ExpenseForm
                  initialValues={editing.initial}
                  onSaved={handleSaved}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}