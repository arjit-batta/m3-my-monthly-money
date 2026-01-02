import { PaymentMode } from '@/types/expense';

export const DEFAULT_PAYMENT_MODES: PaymentMode[] = [
  { id: 'cash', name: 'Cash', type: 'cash' },
  { id: 'upi', name: 'UPI', type: 'bank_account' },
  { id: 'card', name: 'Credit/Debit Card', type: 'credit_card' },
  { id: 'netbanking', name: 'Net Banking', type: 'bank_account' },
  { id: 'wallet', name: 'Wallet', type: 'other' },
];
