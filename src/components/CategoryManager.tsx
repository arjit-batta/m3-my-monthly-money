import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
  getExpenses,
  getBudgets,
  reassignExpenses
} from '@/lib/database';
import { Category, Expense, Budget } from '@/types/expense';
import { toast } from '@/hooks/use-toast';
import { LoadingState, ErrorState } from '@/components/LoadingError';
import { withErrorHandling } from '@/lib/db-utils';

const EMOJI_OPTIONS = ['🍔', '🚗', '🛒', '💡', '🎬', '💊', '📚', '👤', '🏠', '✈️', '🎮', '💰', '🎁', '📱', '🏋️'];
const COLOR_OPTIONS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Category sheet
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '📦', color: '#3b82f6' });
  const [saving, setSaving] = useState(false);
  
  // Sub-category sheet
  const [isSubCategorySheetOpen, setIsSubCategorySheetOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<{ categoryId: string; subId: string; name: string } | null>(null);
  const [subCategoryForm, setSubCategoryForm] = useState({ categoryId: '', name: '' });
  
  // Delete dialogs
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'category' | 'subcategory'; categoryId: string; subId?: string } | null>(null);
  
  // Reassignment state
  const [reassignDialog, setReassignDialog] = useState<{
    type: 'category' | 'subcategory';
    fromCategoryId: string;
    fromSubCategoryId?: string;
    expenseCount: number;
  } | null>(null);
  const [reassignForm, setReassignForm] = useState({ categoryId: '', subCategoryId: '' });
  const [reassigning, setReassigning] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [cats, exps, budgs] = await Promise.all([
        getCategories(),
        getExpenses(),
        getBudgets(),
      ]);
      setCategories(cats);
      setExpenses(exps);
      setBudgets(budgs);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Get dependency counts for sub-category
  const getSubCategoryDependencies = (categoryId: string, subCategoryId: string) => {
    const expenseCount = expenses.filter(e => e.categoryId === categoryId && e.subCategoryId === subCategoryId).length;
    const activeBudget = budgets.find(b => b.categoryId === categoryId && b.subCategoryId === subCategoryId && b.amount > 0);
    return { expenseCount, hasActiveBudget: !!activeBudget, canDelete: expenseCount === 0 && !activeBudget };
  };

  // Get dependency counts for category
  const getCategoryDependencies = (categoryId: string) => {
    const expenseCount = expenses.filter(e => e.categoryId === categoryId).length;
    const budgetCount = budgets.filter(b => b.categoryId === categoryId).length;
    return { expenseCount, budgetCount, hasAny: expenseCount > 0 || budgetCount > 0 };
  };

  // Category handlers
  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', icon: '📦', color: '#3b82f6' });
    setIsCategorySheetOpen(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, icon: category.icon, color: category.color });
    setIsCategorySheetOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Category name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const result = editingCategory
      ? await withErrorHandling(() => updateCategory(editingCategory.id, { name: categoryForm.name.trim(), icon: categoryForm.icon }))
      : await withErrorHandling(() => addCategory({
          name: categoryForm.name.trim(),
          icon: categoryForm.icon,
          subCategories: [{ id: '', name: 'General' }],
        }));
    
    setSaving(false);

    if (result.success === true) {
      toast({ title: editingCategory ? 'Category updated' : 'Category added' });
      await loadData();
      setIsCategorySheetOpen(false);
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to save category',
        description: failedResult.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteDialog || deleteDialog.type !== 'category') return;
    
    const deps = getCategoryDependencies(deleteDialog.categoryId);
    
    // If expenses exist, open reassignment dialog instead of blocking
    if (deps.expenseCount > 0) {
      setDeleteDialog(null);
      setReassignForm({ categoryId: '', subCategoryId: '' });
      setReassignDialog({
        type: 'category',
        fromCategoryId: deleteDialog.categoryId,
        expenseCount: deps.expenseCount,
      });
      return;
    }

    const result = await withErrorHandling(() => deleteCategory(deleteDialog.categoryId));
    
    if (result.success === true) {
      await loadData();
      toast({ title: 'Category deleted' });
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to delete category',
        description: failedResult.error,
        variant: 'destructive' 
      });
    }
    setDeleteDialog(null);
  };

  // Sub-category handlers
  const openAddSubCategory = (categoryId: string) => {
    setEditingSubCategory(null);
    setSubCategoryForm({ categoryId, name: '' });
    setIsSubCategorySheetOpen(true);
  };

  const openEditSubCategory = (categoryId: string, subId: string, name: string) => {
    setEditingSubCategory({ categoryId, subId, name });
    setSubCategoryForm({ categoryId, name });
    setIsSubCategorySheetOpen(true);
  };

  const handleSaveSubCategory = async () => {
    if (!subCategoryForm.name.trim()) {
      toast({ title: 'Sub-category name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const result = editingSubCategory
      ? await withErrorHandling(() => updateSubCategory(editingSubCategory.subId, subCategoryForm.name.trim()))
      : await withErrorHandling(() => addSubCategory(subCategoryForm.categoryId, subCategoryForm.name.trim()));
    
    setSaving(false);

    if (result.success === true) {
      toast({ title: editingSubCategory ? 'Sub-category updated' : 'Sub-category added' });
      await loadData();
      setIsSubCategorySheetOpen(false);
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to save sub-category',
        description: failedResult.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  };

  const handleDeleteSubCategory = async () => {
    if (!deleteDialog || deleteDialog.type !== 'subcategory' || !deleteDialog.subId) return;
    
    const deps = getSubCategoryDependencies(deleteDialog.categoryId, deleteDialog.subId);
    
    // If expenses exist, open reassignment dialog instead of blocking
    if (deps.expenseCount > 0) {
      setDeleteDialog(null);
      setReassignForm({ categoryId: '', subCategoryId: '' });
      setReassignDialog({
        type: 'subcategory',
        fromCategoryId: deleteDialog.categoryId,
        fromSubCategoryId: deleteDialog.subId,
        expenseCount: deps.expenseCount,
      });
      return;
    }

    const result = await withErrorHandling(() => deleteSubCategory(deleteDialog.subId!));
    
    if (result.success === true) {
      await loadData();
      toast({ title: 'Sub-category deleted' });
    } else {
      const failedResult = result as { success: false; error: string; isNetworkError: boolean };
      toast({ 
        title: failedResult.isNetworkError ? 'Connection Error' : 'Failed to delete sub-category',
        description: failedResult.error,
        variant: 'destructive' 
      });
    }
    setDeleteDialog(null);
  };

  // Handle reassignment and then deletion
  const handleReassignAndDelete = async () => {
    if (!reassignDialog || !reassignForm.categoryId || !reassignForm.subCategoryId) {
      toast({ title: 'Please select a destination', variant: 'destructive' });
      return;
    }

    setReassigning(true);
    
    try {
      // Reassign expenses
      await reassignExpenses(
        reassignDialog.fromCategoryId,
        reassignDialog.fromSubCategoryId || null,
        reassignForm.categoryId,
        reassignForm.subCategoryId
      );
      
      // Now delete the category or sub-category
      if (reassignDialog.type === 'category') {
        await deleteCategory(reassignDialog.fromCategoryId);
        toast({ title: 'Expenses reassigned and category deleted' });
      } else if (reassignDialog.fromSubCategoryId) {
        await deleteSubCategory(reassignDialog.fromSubCategoryId);
        toast({ title: 'Expenses reassigned and sub-category deleted' });
      }
      
      await loadData();
      setReassignDialog(null);
    } catch (err) {
      console.error('Reassignment failed:', err);
      toast({ 
        title: 'Failed to reassign expenses',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive' 
      });
    } finally {
      setReassigning(false);
    }
  };

  // Get available destination categories/sub-categories (excluding the one being deleted)
  const getDestinationOptions = () => {
    if (!reassignDialog) return [];
    
    return categories
      .filter(c => {
        // For category deletion, exclude the category being deleted
        if (reassignDialog.type === 'category') {
          return c.id !== reassignDialog.fromCategoryId;
        }
        return true;
      })
      .filter(c => c.subCategories.length > 0); // Only show categories with sub-categories
  };

  const getDestinationSubCategories = () => {
    if (!reassignForm.categoryId || !reassignDialog) return [];
    
    const category = categories.find(c => c.id === reassignForm.categoryId);
    if (!category) return [];
    
    // For sub-category deletion within the same category, exclude the one being deleted
    if (reassignDialog.type === 'subcategory' && reassignForm.categoryId === reassignDialog.fromCategoryId) {
      return category.subCategories.filter(sc => sc.id !== reassignDialog.fromSubCategoryId);
    }
    
    return category.subCategories;
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        </div>
        <Button size="sm" onClick={openAddCategory}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <Card key={category.id}>
            <Collapsible open={expandedCategories.has(category.id)} onOpenChange={() => toggleCategory(category.id)}>
              <CardContent className="p-0">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-lg" style={{ backgroundColor: category.color + '20' }}>
                        {category.icon}
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {category.subCategories.length} sub-categor{category.subCategories.length === 1 ? 'y' : 'ies'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive" 
                        onClick={() => setDeleteDialog({ type: 'category', categoryId: category.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t px-4 pb-4">
                    <div className="mt-3 space-y-2">
                      {category.subCategories.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                          <span className="text-sm">{sub.name}</span>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => openEditSubCategory(category.id, sub.id, sub.name)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteDialog({ type: 'subcategory', categoryId: category.id, subId: sub.id })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3 w-full"
                      onClick={() => openAddSubCategory(category.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Sub-category
                    </Button>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Category Sheet */}
      <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 pb-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <Button
                    key={emoji}
                    variant={categoryForm.icon === emoji ? 'default' : 'outline'}
                    size="icon"
                    className="h-10 w-10 text-lg"
                    onClick={() => setCategoryForm({ ...categoryForm, icon: emoji })}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${categoryForm.color === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm({ ...categoryForm, color })}
                    type="button"
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCategory} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCategory ? 'Save Changes' : 'Add Category'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sub-category Sheet */}
      <Sheet open={isSubCategorySheetOpen} onOpenChange={setIsSubCategorySheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>{editingSubCategory ? 'Edit Sub-category' : 'Add Sub-category'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 pb-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={subCategoryForm.name}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                placeholder="Sub-category name"
              />
            </div>
            <Button onClick={handleSaveSubCategory} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSubCategory ? 'Save Changes' : 'Add Sub-category'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteDialog?.type === 'category' ? 'Category' : 'Sub-category'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === 'category' 
                ? 'This will delete the category and all its sub-categories.'
                : 'This will delete the sub-category.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteDialog?.type === 'category' ? handleDeleteCategory : handleDeleteSubCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassignment Sheet */}
      <Sheet open={!!reassignDialog} onOpenChange={(open) => !open && setReassignDialog(null)}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Reassign Expenses</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 pb-6">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm">
                <span className="font-medium">{reassignDialog?.expenseCount} expense(s)</span> are linked to this {reassignDialog?.type === 'category' ? 'category' : 'sub-category'}. 
                Please select where to move them before deletion.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Move to Category</Label>
              <Select 
                value={reassignForm.categoryId} 
                onValueChange={(value) => setReassignForm({ categoryId: value, subCategoryId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {getDestinationOptions().map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reassignForm.categoryId && (
              <div className="space-y-2">
                <Label>Move to Sub-category</Label>
                <Select 
                  value={reassignForm.subCategoryId} 
                  onValueChange={(value) => setReassignForm({ ...reassignForm, subCategoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDestinationSubCategories().map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setReassignDialog(null)}
                disabled={reassigning}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleReassignAndDelete}
                disabled={!reassignForm.categoryId || !reassignForm.subCategoryId || reassigning}
              >
                {reassigning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Reassign & Delete
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
