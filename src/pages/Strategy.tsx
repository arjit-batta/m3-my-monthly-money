import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { Sparkles, Lock, AlertTriangle, AlertCircle, CreditCard, CalendarClock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState } from '@/components/LoadingError';
import { getExpenses, getPaymentModes } from '@/lib/database';
import { Expense, PaymentMode } from '@/types/expense';
import { getAllCardStrategies, CardStrategy } from '@/lib/cardStrategies';
import {
  Subscription,
  getSubscriptions,
  monthlyBurnFor,
  totalMonthlyBurn,
} from '@/lib/subscriptions';
import { getMyProfile } from '@/lib/profile';
import { track } from '@/lib/analytics';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

interface CardRow {
  mode: PaymentMode;
  strategy: CardStrategy | null;
  monthSpend: number;
  daysSinceLastUsed: number | null;
  state: 'ok' | 'approaching' | 'dormant' | 'unused';
  keptAliveBy: { name: string; daysUntil: number } | null;
}

function classifyKeepAlive(days: number | null, cadence: number): CardRow['state'] {
  if (days === null) return 'unused';
  if (days > cadence) return 'dormant';
  if (days >= cadence * 0.8) return 'approaching';
  return 'ok';
}

export function StrategyView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [modes, setModes] = useState<PaymentMode[]>([]);
  const [strategies, setStrategies] = useState<CardStrategy[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const profile = await getMyProfile();
        const premium = !!profile?.isPremium;
        if (cancelled) return;
        setIsPremium(premium);
        if (!premium) {
          track('paywall_viewed', { surface: 'strategy' });
          setLoading(false);
          return;
        }
        track('strategy_viewed');
        const [m, s, e, sub] = await Promise.all([
          getPaymentModes(),
          getAllCardStrategies(),
          getExpenses(),
          getSubscriptions(),
        ]);
        if (cancelled) return;
        setModes(m);
        setStrategies(s);
        setExpenses(e);
        setSubs(sub);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load strategy');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return format(d, 'yyyy-MM-dd');
  }, [today]);

  const cardRows: CardRow[] = useMemo(() => {
    const creditCards = modes.filter((m) => m.type === 'credit_card');
    return creditCards.map((mode) => {
      const strategy = strategies.find((s) => s.paymentModeId === mode.id) ?? null;
      const cardExpenses = expenses.filter((e) => e.paymentModeId === mode.id);
      const monthSpend = cardExpenses
        .filter((e) => e.date >= monthStart)
        .reduce((sum, e) => sum + e.amount, 0);
      let daysSinceLastUsed: number | null = null;
      if (cardExpenses.length > 0) {
        const last = cardExpenses
          .map((e) => e.date)
          .sort()
          .slice(-1)[0];
        daysSinceLastUsed = differenceInCalendarDays(today, parseISO(last));
      }
      const cadence = strategy?.keepAliveCadenceDays || 30;
      const cardSubs = subs
        .filter((s) => s.status === 'active' && s.paymentModeId === mode.id)
        .map((s) => ({ sub: s, days: differenceInCalendarDays(parseISO(s.nextRenewalDate), today) }))
        .filter(({ days }) => days >= 0)
        .sort((a, b) => a.days - b.days);
      const nextSub = cardSubs[0] ?? null;
      const keptAliveBy = strategy?.keepAlive && nextSub
        ? { name: nextSub.sub.name, daysUntil: nextSub.days }
        : null;
      let state = strategy?.keepAlive
        ? classifyKeepAlive(daysSinceLastUsed, cadence)
        : 'ok';
      if (
        strategy?.keepAlive &&
        nextSub &&
        nextSub.days <= cadence &&
        (state === 'approaching' || state === 'dormant' || state === 'unused')
      ) {
        state = 'ok';
      }
      return { mode, strategy, monthSpend, daysSinceLastUsed, state, keptAliveBy };
    });
  }, [modes, strategies, expenses, subs, monthStart, today]);

  const upcomingRenewals = useMemo(() => {
    return subs
      .filter((s) => s.status === 'active')
      .map((s) => ({
        sub: s,
        days: differenceInCalendarDays(parseISO(s.nextRenewalDate), today),
      }))
      .filter(({ days }) => days >= 0 && days <= 14)
      .sort((a, b) => a.days - b.days);
  }, [subs, today]);

  if (loading) {
    return (
      <div className="py-6">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="py-10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Strategy
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Card &amp; Subscription Strategy is a premium feature. Upgrade to track keep-alive
            cards, monthly card spend, and upcoming subscription renewals in one place.
          </p>
      </div>
    );
  }

  const monthlyBurn = totalMonthlyBurn(subs);
  const modeName = (id: string | null) =>
    id ? modes.find((m) => m.id === id)?.name ?? 'Unknown' : '—';

  return (
    <div className="py-4 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Strategy
          </h1>
          <p className="text-sm text-muted-foreground">Cards and subscriptions at a glance.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cards
          </h2>
          {cardRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit cards added yet.</p>
          ) : (
            cardRows.map((row) => (
              <Card key={row.mode.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{row.mode.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">This month</p>
                      <p className="font-semibold">{formatCurrency(row.monthSpend)}</p>
                    </div>
                  </div>

                  {row.strategy && row.strategy.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {row.strategy.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {row.daysSinceLastUsed === null
                        ? 'Never used'
                        : row.daysSinceLastUsed === 0
                          ? 'Used today'
                          : `Last used ${row.daysSinceLastUsed} day${row.daysSinceLastUsed === 1 ? '' : 's'} ago`}
                    </span>
                    {row.strategy?.keepAlive && (
                      <>
                        <span className="text-muted-foreground">
                          • Keep-alive every {row.strategy.keepAliveCadenceDays}d
                        </span>
                        {row.state === 'approaching' && (
                          <Badge variant="secondary" className="gap-1 bg-orange-500/15 text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" /> Approaching dormancy
                          </Badge>
                        )}
                        {row.state === 'dormant' && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Dormant
                          </Badge>
                        )}
                        {row.state === 'unused' && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Never used
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {row.keptAliveBy && (
                    <p className="text-xs text-muted-foreground">
                      Kept alive by {row.keptAliveBy.name} — next charge{' '}
                      {row.keptAliveBy.daysUntil === 0
                        ? 'today'
                        : row.keptAliveBy.daysUntil === 1
                          ? 'tomorrow'
                          : `in ${row.keptAliveBy.daysUntil} days`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Subscriptions
          </h2>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total monthly burn</p>
                <p className="text-xl font-bold">{formatCurrency(monthlyBurn)}</p>
              </div>
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
            </CardContent>
          </Card>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Upcoming renewals (next 14 days)</p>
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewals in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {upcomingRenewals.map(({ sub, days }) => (
                  <Card key={sub.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{sub.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {modeName(sub.paymentModeId)} • {formatCurrency(monthlyBurnFor(sub))}/mo
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold">{formatCurrency(sub.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
    </div>
  );
}

export default function Strategy() {
  return (
    <AppLayout>
      <StrategyView />
    </AppLayout>
  );
}