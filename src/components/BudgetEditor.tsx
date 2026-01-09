import { useState, useEffect } from 'react';
import { IndianRupee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCategories, setBudget } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/types/expense';

interface BudgetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  initialCategoryId?: string;
  initialSubCategoryId?: string;
  initialAmount?: number;
  onSave?: () => void;
}

export function BudgetEditor({
  open,
  onOpenChange,
  month,
  year,
  initialCategoryId = '',
  initialSubCategoryId = '',
  initialAmount = 0,
  onSave,
}: BudgetEditorProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subCategoryId, setSubCategoryId] = useState(initialSubCategoryId);
  const [amount, setAmount] = useState(initialAmount >= 0 ? String(initialAmount) : '');

  // Load categories
  useEffect(() => {
    if (open) {
      setLoading(true);
      getCategories()
        .then(setCategories)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subCategories = selectedCategory?.subCategories || [];

  // Reset form when dialog opens with initial values
  useEffect(() => {
    if (open) {
      setCategoryId(initialCategoryId);
      setSubCategoryId(initialSubCategoryId);
      setAmount(String(initialAmount));
    }
  }, [open, initialCategoryId, initialSubCategoryId, initialAmount]);

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setSubCategoryId('');
  };

  const isValid = categoryId && subCategoryId && amount !== '' && parseFloat(amount) >= 0;

  const handleSave = async () => {
    if (!isValid) return;

    setSaving(true);
    try {
      await setBudget({
        categoryId,
        subCategoryId,
        month,
        year,
        amount: parseFloat(amount),
      });

      toast({
        title: 'Budget saved',
        duration: 2000,
      });

      onOpenChange(false);
      onSave?.();
    } catch (error) {
      console.error('Failed to save budget:', error);
      toast({ title: 'Failed to save budget', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isEditing = initialCategoryId !== '' && initialSubCategoryId !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={handleCategoryChange} disabled={isEditing}>
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
                disabled={!categoryId || isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder={categoryId ? 'Select sub-category' : 'Select category first'} />
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

            {/* Amount */}
            <div className="space-y-2">
              <Label>Monthly Budget Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Set to 0 to remove budget tracking for this sub-category.
              </p>
            </div>

            <Button onClick={handleSave} disabled={!isValid || saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Budget
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
