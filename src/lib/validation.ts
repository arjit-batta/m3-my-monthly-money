import { z } from 'zod';

export const expenseSchema = z.object({
  amount: z.number().positive({ message: 'Amount must be greater than 0' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid date format' }),
  categoryId: z.string().min(1, { message: 'Category is required' }),
  subCategoryId: z.string().min(1, { message: 'Sub-category is required' }), // MANDATORY
  paymentModeId: z.string().min(1, { message: 'Payment mode is required' }),
  notes: z.string().max(200, { message: 'Notes must be less than 200 characters' }).optional(),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, { message: 'Category is required' }),
  subCategoryId: z.string().min(1, { message: 'Sub-category is required' }),
  month: z.number().min(1).max(12, { message: 'Month must be between 1 and 12' }),
  year: z.number().min(2020).max(2100, { message: 'Year must be between 2020 and 2100' }),
  amount: z.number().positive({ message: 'Budget amount must be greater than 0' }),
});

export const categorySchema = z.object({
  name: z.string().min(1, { message: 'Category name is required' }).max(50),
  icon: z.string().min(1, { message: 'Icon is required' }),
  color: z.string().min(1, { message: 'Color is required' }),
  subCategories: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1, { message: 'Sub-category name is required' }).max(50),
      })
    )
    .min(1, { message: 'At least one sub-category is required' }), // MANDATORY
});

export const subCategorySchema = z.object({
  name: z.string().min(1, { message: 'Sub-category name is required' }).max(50),
});

export const paymentModeSchema = z.object({
  name: z.string().min(1, { message: 'Payment mode name is required' }).max(50),
  type: z.enum(['credit_card', 'bank_account', 'cash', 'other']).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SubCategoryInput = z.infer<typeof subCategorySchema>;
export type PaymentModeInput = z.infer<typeof paymentModeSchema>;
