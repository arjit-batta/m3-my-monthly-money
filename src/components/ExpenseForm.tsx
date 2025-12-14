import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, IndianRupee } from 'lucide-react';
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
import { Category, PaymentMode } from '@/types/expense';
import { getCategories, addExpense, generateId } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Net Banking' },
  { value: 'wallet', label: 'Wallet' },
];

export function ExpenseForm() {
  const { toast } = useToast();
  const categories = useMemo(() => getCategories(), []);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('');
  const [notes, setNotes] = useState('');

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subCategories = selectedCategory?.subCategories || [];

  const isFormValid = useMemo(() => {
    const amountNum = parseFloat(amount);
    return (
      amountNum > 0 &&
      date &&
      categoryId !== '' &&
      subCategoryId !== '' &&
      paymentMode !== ''
    );
  }, [amount, date, categoryId, subCategoryId, paymentMode]);

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setSubCategoryId(''); // Reset sub-category when category changes
  };

  const handleSubmit = () => {
    if (!isFormValid) return;

    const expense = {
      id: generateId(),
      amount: parseFloat(amount),
      date: format(date, 'yyyy-MM-dd'),
      categoryId,
      subCategoryId,
      paymentMode: paymentMode as PaymentMode,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    addExpense(expense);

    toast({
      title: 'Expense added',
      description: `₹${amount} recorded successfully`,
    });

    // Reset form
    setAmount('');
    setDate(new Date());
    setCategoryId('');
    setSubCategoryId('');
    setPaymentMode('');
    setNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-9 text-lg font-medium"
          />
        </div>
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
          <SelectTrigger>
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
      </div>

      {/* Sub-category */}
      <div className="space-y-2">
        <Label>Sub-category</Label>
        <Select
          value={subCategoryId}
          onValueChange={setSubCategoryId}
          disabled={!categoryId}
        >
          <SelectTrigger className={!categoryId ? 'opacity-50' : ''}>
            <SelectValue
              placeholder={
                categoryId ? 'Select sub-category' : 'Select category first'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {subCategories.map((sub) => (
              <SelectItem key={sub.id} value={sub.id}>
                {sub.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payment Mode */}
      <div className="space-y-2">
        <Label>Payment Mode</Label>
        <Select
          value={paymentMode}
          onValueChange={(v) => setPaymentMode(v as PaymentMode)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select payment mode" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        disabled={!isFormValid}
        className="w-full text-base font-medium"
        size="lg"
      >
        Save Expense
      </Button>
    </div>
  );
}
