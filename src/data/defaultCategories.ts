import { Category } from '@/types/expense';

// Every category MUST have at least one sub-category
// Sub-categories are mandatory and cannot be empty
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: 'Food & Dining',
    icon: '🍽️',
    color: 'hsl(24, 100%, 60%)',
    subCategories: [
      { id: 'groceries', name: 'Groceries' },
      { id: 'dining-out', name: 'Dining Out' },
      { id: 'snacks', name: 'Snacks' },
      { id: 'beverages', name: 'Beverages' },
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚗',
    color: 'hsl(210, 100%, 56%)',
    subCategories: [
      { id: 'fuel', name: 'Fuel' },
      { id: 'cab', name: 'Cab' },
      { id: 'public-transport', name: 'Public Transport' },
      { id: 'parking', name: 'Parking' },
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: 'hsl(280, 80%, 60%)',
    subCategories: [
      { id: 'clothing', name: 'Clothing' },
      { id: 'electronics', name: 'Electronics' },
      { id: 'home-decor', name: 'Home Decor' },
      { id: 'personal-care', name: 'Personal Care' },
    ],
  },
  {
    id: 'bills',
    name: 'Bills & Utilities',
    icon: '📄',
    color: 'hsl(45, 100%, 50%)',
    subCategories: [
      { id: 'electricity', name: 'Electricity' },
      { id: 'water', name: 'Water' },
      { id: 'internet', name: 'Internet' },
      { id: 'mobile', name: 'Mobile Recharge' },
      { id: 'gas', name: 'Gas' },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: 'hsl(340, 80%, 55%)',
    subCategories: [
      { id: 'movies', name: 'Movies' },
      { id: 'streaming', name: 'Streaming Services' },
      { id: 'games', name: 'Games' },
      { id: 'events', name: 'Events & Concerts' },
    ],
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    icon: '💊',
    color: 'hsl(150, 70%, 45%)',
    subCategories: [
      { id: 'medicines', name: 'Medicines' },
      { id: 'doctor', name: 'Doctor Visits' },
      { id: 'gym', name: 'Gym & Fitness' },
      { id: 'insurance', name: 'Health Insurance' },
    ],
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: 'hsl(200, 80%, 50%)',
    subCategories: [
      { id: 'courses', name: 'Courses' },
      { id: 'books', name: 'Books' },
      { id: 'tuition', name: 'Tuition Fees' },
      { id: 'supplies', name: 'Supplies' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: '👤',
    color: 'hsl(180, 60%, 50%)',
    subCategories: [
      { id: 'gifts', name: 'Gifts' },
      { id: 'donations', name: 'Donations' },
      { id: 'subscriptions', name: 'Subscriptions' },
      { id: 'miscellaneous', name: 'Miscellaneous' },
    ],
  },
];

// Validation: Ensure no category exists without sub-categories
export function validateCategory(category: Category): boolean {
  return category.subCategories.length > 0;
}

export function validateAllCategories(categories: Category[]): boolean {
  return categories.every(validateCategory);
}
