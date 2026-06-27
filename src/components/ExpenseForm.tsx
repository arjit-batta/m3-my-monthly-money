import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, IndianRupee, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { getCategories, getPaymentModes, addExpense } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Category, PaymentMode } from '@/types/expense';
import { LoadingState, ErrorState } from '@/components/LoadingError';
import { withErrorHandling, getErrorMessage, isNetworkError } from '@/lib/db-utils';

const STORAGE_KEYS = {
  LAST_CATEGORY: 'expense-last-category',
  LAST_PAYMENT_MODE: 'expense-last-payment-mode',
};

function getLastUsedValues() {
  return {
    categoryId: localStorage.getItem(STORAGE_KEYS.LAST_CATEGORY) || '',
    paymentModeId: localStorage.getItem(STORAGE_KEYS.LAST_PAYMENT_MODE) || '',
  };
}

function saveLastUsedValues(categoryId: string, paymentModeId: string) {
  localStorage.setItem(STORAGE_KEYS.LAST_CATEGORY, categoryId);
  localStorage.setItem(STORAGE_KEYS.LAST_PAYMENT_MODE, paymentModeId);
}

export interface ExpenseFormInitialValues {
  amount?: number;
  date?: Date;
  categoryId?: string;
  subCategoryId?: string;
  paymentModeId?: string;
  notes?: string;
}

interface ExpenseFormProps {
  initialValues?: ExpenseFormInitialValues;
  onSaved?: () => void;
}

export function ExpenseForm({ initialValues, onSaved }: ExpenseFormProps = {}) {
  const { toast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const lastUsed = getLastUsedValues();
  const hasInitial = !!initialValues;

  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState(
    initialValues?.amount != null ? String(initialValues.amount) : ''
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [date, setDate] = useState<Date>(initialValues?.date ?? new Date());
  const [categoryId, setCategoryId] = useState(
    initialValues?.categoryId ?? lastUsed.categoryId
  );
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [subCategoryId, setSubCategoryId] = useState(
    initialValues?.subCategoryId ?? ''
  );
  const [subCategoryTouched, setSubCategoryTouched] = useState(false);
  const [paymentModeId, setPaymentModeId] = useState(
    initialValues?.paymentModeId ?? lastUsed.paymentModeId
  );
  const [paymentModeTouched, setPaymentModeTouched] = useState(false);
  const [notes, setNotes] = useState(initialValues?.notes ?? '');

  // Load data on mount
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, modes] = await Promise.all([getCategories(), getPaymentModes()]);
      setCategories(cats);
      setPaymentModes(modes);
    } catch (err) {
      console.error('Failed to load form data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-focus amount input on mount
  useEffect(() => {
    if (!loading) {
      amountInputRef.current?.focus();
    }
  }, [loading]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subCategories = selectedCategory?.subCategories || [];

  // Validation - sub-category only required if category has sub-categories
  const hasSubCategories = subCategories.length > 0;
  const amountNum = parseFloat(amount);
  const amountError = amountTouched && (isNaN(amountNum) || amountNum <= 0) ? 'Amount must be greater than 0' : '';
  const categoryError = categoryTouched && !categoryId ? 'Category is required' : '';
  const subCategoryError = subCategoryTouched && hasSubCategories && !subCategoryId ? 'Sub-category is required' : '';
  const paymentModeError = paymentModeTouched && !paymentModeId ? 'Payment mode is required' : '';

  const isFormValid = (() => {
    const amountNum = parseFloat(amount);
    const subCategoryValid = !hasSubCategories || subCategoryId !== '';
    return (
      amountNum > 0 &&
      date &&
      categoryId !== '' &&
      subCategoryValid &&
      paymentModeId !== ''
    );
  })();

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setCategoryTouched(true);
    setSubCategoryId(''); // Reset sub-category when category changes
    setSubCategoryTouched(false);
  };

  const handleSubmit = async () => {
    // Touch all fields to show errors
    setAmountTouched(true);
    setCategoryTouched(true);
    setSubCategoryTouched(true);
    setPaymentModeTouched(true);

    if (!isFormValid) return;

    setSubmitting(true);
    
    // Capture form values before submission to prevent state corruption
    const expenseData = {
      amount: parseFloat(amount),
      date: format(date, 'yyyy-MM-dd'),
      categoryId,
      subCategoryId: subCategoryId || '',
      paymentModeId,
      notes: notes.trim() || undefined,
    };

    const result = await withErrorHandling(() => addExpense(expenseData));
    
    setSubmitting(false);

    if (result.success === true) {
      if (!hasInitial) {
        saveLastUsedValues(categoryId, paymentModeId);
      }

      toast({
        title: 'Expense saved',
        description: `₹${amount} added`,
        duration: 2000,
      });

      if (onSaved) {
        onSaved();
        return;
      }

      // Reset form but keep category and payment mode
      setAmount('');
      setAmountTouched(false);
      setDate(new Date());
      setSubCategoryId('');
      setSubCategoryTouched(false);
      setNotes('');

      // Refocus amount input
      amountInputRef.current?.focus();
    } else {
      // Handle failure - form state is preserved for retry
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to save expense',
        description: failedResult.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-5">
      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={amountInputRef}
            id="amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setAmountTouched(true)}
            className={cn('pl-9 text-lg font-medium', amountError && 'border-destructive')}
          />
        </div>
        {amountError && <p className="text-sm text-destructive">{amountError}</p>}
      </div>

      {/* Date Picker */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={handleCategoryChange}>
          <SelectTrigger className={cn(categoryError && 'border-destructive')}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
      </div>

      {/* Sub-category */}
      {categoryId && hasSubCategories && (
        <div className="space-y-2">
          <Label>Sub-category</Label>
          <Select
            value={subCategoryId}
            onValueChange={(v) => {
              setSubCategoryId(v);
              setSubCategoryTouched(true);
            }}
          >
            <SelectTrigger className={cn(subCategoryError && 'border-destructive')}>
              <SelectValue placeholder="Select sub-category" />
            </SelectTrigger>
            <SelectContent>
              {subCategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subCategoryError && <p className="text-sm text-destructive">{subCategoryError}</p>}
        </div>
      )}
      {categoryId && !hasSubCategories && (
        <p className="text-sm text-muted-foreground">No sub-categories defined for this category</p>
      )}

      {/* Payment Mode */}
      <div className="space-y-2">
        <Label>Payment Mode</Label>
        <Select
          value={paymentModeId}
          onValueChange={(v) => {
            setPaymentModeId(v);
            setPaymentModeTouched(true);
          }}
        >
          <SelectTrigger className={cn(paymentModeError && 'border-destructive')}>
            <SelectValue placeholder="Select payment mode" />
          </SelectTrigger>
          <SelectContent>
            {paymentModes.map((mode) => (
              <SelectItem key={mode.id} value={mode.id}>
                {mode.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {paymentModeError && <p className="text-sm text-destructive">{paymentModeError}</p>}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Add a note..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={200}
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isFormValid || submitting}
        className="w-full text-base font-medium"
        size="lg"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Expense
      </Button>
    </div>
  );
}
