import { PaymentMode } from '@/types/expense';

export const DEFAULT_PAYMENT_MODES: PaymentMode[] = [
  { id: 'cash', name: 'Cash', type: 'cash' },
  { id: 'upi', name: 'UPI', type: 'bank_account' },
  { id: 'credit-card', name: 'Credit Card', type: 'credit_card' },
  { id: 'debit-card', name: 'Debit Card', type: 'credit_card' },
  { id: 'bank-transfer', name: 'Bank Transfer', type: 'bank_account' },
];
