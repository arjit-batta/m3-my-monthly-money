import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ExpenseForm,
  type ExpenseFormInitialValues,
} from '@/components/ExpenseForm';
import { VoiceBatchReview, type BatchEntryInput } from '@/components/VoiceBatchReview';

type ParsedEntry = {
  amount: number;
  category_id: string | null;
  sub_category_id: string | null;
  payment_mode_id: string | null;
  note: string;
  matched_by: 'mapping' | 'ai';
};

function getSpeechRecognition(): any | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function deriveKeyword(note: string): string {
  return note
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b\d+(\.\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

export function VoiceExpenseCapture({ onSaved }: { onSaved?: () => void } = {}) {
  const SR = useMemo(() => getSpeechRecognition(), []);
  const supported = !!SR;
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [editing, setEditing] = useState<{
    initial: ExpenseFormInitialValues;
    keyword: string;
    matchedBy: 'mapping' | 'ai';
  } | null>(null);
  const [batch, setBatch] = useState<BatchEntryInput[] | null>(null);

  const handleTranscript = useCallback(async (transcript: string) => {
    const text = transcript.trim();
    if (!text) {
      toast({
        title: "Didn't catch that",
        description: 'Please try speaking again.',
        variant: 'destructive',
      });
      return;
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-expense', {
        body: { transcript: text },
      });

      if (error) {
        let msg =
          (data as any)?.error ||
          (error as any)?.message ||
          'Could not reach the parser. Check your connection and try again.';
        // FunctionsHttpError carries the actual response body — read it for the real reason.
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx && typeof ctx.text === 'function') {
            const body = await ctx.text();
            if (body) msg = body;
          }
        } catch {
          // ignore – keep fallback message
        }
        toast({ title: 'Voice parsing failed', description: msg, variant: 'destructive' });
        return;
      }

      const entries: ParsedEntry[] = Array.isArray((data as any)?.entries)
        ? (data as any).entries
        : [];

      if (entries.length === 0) {
        toast({
          title: 'No expense detected',
          description: 'Try saying something like "coffee 200".',
          variant: 'destructive',
        });
        return;
      }

      if (entries.length > 1) {
        setBatch(entries);
        return;
      }

      const entry = entries[0];
      setEditing({
        initial: {
          amount: entry.amount,
          categoryId: entry.category_id ?? undefined,
          subCategoryId: entry.sub_category_id ?? undefined,
          paymentModeId: entry.payment_mode_id ?? undefined,
          notes: entry.note,
        },
        keyword: deriveKeyword(entry.note || text),
        matchedBy: entry.matched_by,
      });
    } catch (err) {
      console.error('parse-expense invoke failed', err);
      toast({
        title: 'No internet?',
        description:
          err instanceof Error
            ? err.message
            : 'Could not reach the parser. Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SR) return;
    if (listening || parsing) return;
    try {
      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
        handleTranscript(transcript);
      };
      recognition.onerror = (event: any) => {
        const code = event?.error;
        const msg =
          code === 'no-speech'
            ? "Didn't hear anything — please try again."
            : code === 'not-allowed' || code === 'service-not-allowed'
            ? 'Microphone permission was denied.'
            : code === 'network'
            ? 'Speech recognition needs an internet connection.'
            : 'Could not capture audio. Please try again.';
        toast({ title: 'Voice input failed', description: msg, variant: 'destructive' });
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition', err);
      setListening(false);
      toast({
        title: 'Voice input unavailable',
        description: 'Your browser blocked the microphone. Try again or use the form below.',
        variant: 'destructive',
      });
    }
  }, [SR, listening, parsing, handleTranscript]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const handleSaved = useCallback(
    async (saved: {
      amount: number;
      categoryId: string;
      subCategoryId: string;
      paymentModeId: string;
      notes?: string;
    }) => {
      const keyword = editing?.keyword?.trim();
      if (keyword && saved.categoryId) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (userId) {
            await supabase.from('voice_mappings').upsert(
              {
                user_id: userId,
                keyword,
                category_id: saved.categoryId,
                sub_category_id: saved.subCategoryId || null,
              },
              { onConflict: 'user_id,keyword' },
            );
          }
        } catch (err) {
          console.error('Failed to upsert voice mapping', err);
        }
      }
      setEditing(null);
      onSaved?.();
    },
    [editing, onSaved],
  );

  if (!supported) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Voice input isn't supported on this browser. Use the form below to add an expense.
      </div>
    );
  }

  const busy = listening || parsing;

  return (
    <>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <Button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={parsing}
          className={cn(
            'w-full justify-center gap-2 rounded-xl py-6 text-base font-semibold',
            listening && 'bg-destructive hover:bg-destructive/90',
          )}
          size="lg"
        >
          {parsing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Parsing…
            </>
          ) : listening ? (
            <>
              <MicOff className="h-5 w-5" />
              Stop listening
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              Tap to speak
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {busy
            ? listening
              ? 'Listening… say something like "coffee 200"'
              : 'Understanding your expense…'
            : 'Or fill in the form below'}
        </p>
      </div>

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
                <SheetTitle>Review voice expense</SheetTitle>
                <SheetDescription>
                  We parsed your voice input. Adjust anything before saving.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <ExpenseForm
                  initialValues={editing.initial}
                  onSaved={handleSaved}
                  captureMethod="voice"
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <VoiceBatchReview
        open={!!batch}
        entries={batch ?? []}
        onOpenChange={(open) => {
          if (!open) setBatch(null);
        }}
        onSavedAll={() => {
          onSaved?.();
        }}
      />
    </>
  );
}