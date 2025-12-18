import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory,
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
  generateId,
  getExpenses,
  getBudgets
} from '@/lib/storage';
import { Category } from '@/types/expense';
import { toast } from '@/hooks/use-toast';

const EMOJI_OPTIONS = ['🍔', '🚗', '🛒', '💡', '🎬', '💊', '📚', '👤', '🏠', '✈️', '🎮', '💰', '🎁', '📱', '🏋️'];
const COLOR_OPTIONS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export function CategoryManager() {
  const [categories, setCategories] = useState(getCategories);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Category sheet
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '📦', color: '#3b82f6' });
  
  // Sub-category sheet
  const [isSubCategorySheetOpen, setIsSubCategorySheetOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<{ categoryId: string; subId: string; name: string } | null>(null);
  const [subCategoryForm, setSubCategoryForm] = useState({ categoryId: '', name: '' });
  
  // Delete dialogs
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'category' | 'subcategory'; categoryId: string; subId?: string } | null>(null);

  const refreshCategories = () => setCategories(getCategories());

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Check if sub-category has dependencies
  const hasSubCategoryDependencies = (categoryId: string, subCategoryId: string): boolean => {
    const expenses = getExpenses();
    const budgets = getBudgets();
    
    const hasExpenses = expenses.some(e => e.categoryId === categoryId && e.subCategoryId === subCategoryId);
    const hasBudgets = budgets.some(b => b.categoryId === categoryId && b.subCategoryId === subCategoryId);
    
    return hasExpenses || hasBudgets;
  };

  // Check if category has dependencies (any expenses or budgets)
  const hasCategoryDependencies = (categoryId: string): boolean => {
    const expenses = getExpenses();
    const budgets = getBudgets();
    
    return expenses.some(e => e.categoryId === categoryId) || budgets.some(b => b.categoryId === categoryId);
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

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Category name is required', variant: 'destructive' });
      return;
    }

    if (editingCategory) {
      updateCategory(editingCategory.id, { name: categoryForm.name.trim(), icon: categoryForm.icon, color: categoryForm.color });
      toast({ title: 'Category updated' });
    } else {
      const newCategory: Category = {
        id: generateId(),
        name: categoryForm.name.trim(),
        icon: categoryForm.icon,
        color: categoryForm.color,
        subCategories: [{ id: generateId(), name: 'General' }],
      };
      addCategory(newCategory);
      toast({ title: 'Category added' });
    }
    
    refreshCategories();
    setIsCategorySheetOpen(false);
  };

  const handleDeleteCategory = () => {
    if (!deleteDialog || deleteDialog.type !== 'category') return;
    
    if (hasCategoryDependencies(deleteDialog.categoryId)) {
      toast({ title: 'Cannot delete', description: 'This category has expenses or budgets', variant: 'destructive' });
      setDeleteDialog(null);
      return;
    }

    deleteCategory(deleteDialog.categoryId);
    refreshCategories();
    toast({ title: 'Category deleted' });
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

  const handleSaveSubCategory = () => {
    if (!subCategoryForm.name.trim()) {
      toast({ title: 'Sub-category name is required', variant: 'destructive' });
      return;
    }

    if (editingSubCategory) {
      updateSubCategory(editingSubCategory.categoryId, editingSubCategory.subId, { name: subCategoryForm.name.trim() });
      toast({ title: 'Sub-category updated' });
    } else {
      addSubCategory(subCategoryForm.categoryId, { id: generateId(), name: subCategoryForm.name.trim() });
      toast({ title: 'Sub-category added' });
    }
    
    refreshCategories();
    setIsSubCategorySheetOpen(false);
  };

  const handleDeleteSubCategory = () => {
    if (!deleteDialog || deleteDialog.type !== 'subcategory' || !deleteDialog.subId) return;
    
    const category = categories.find(c => c.id === deleteDialog.categoryId);
    if (category && category.subCategories.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Category must have at least one sub-category', variant: 'destructive' });
      setDeleteDialog(null);
      return;
    }

    if (hasSubCategoryDependencies(deleteDialog.categoryId, deleteDialog.subId)) {
      toast({ title: 'Cannot delete', description: 'This sub-category has expenses or budgets', variant: 'destructive' });
      setDeleteDialog(null);
      return;
    }

    deleteSubCategory(deleteDialog.categoryId, deleteDialog.subId);
    refreshCategories();
    toast({ title: 'Sub-category deleted' });
    setDeleteDialog(null);
  };

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
            <Button onClick={handleSaveCategory} className="w-full">
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
            <Button onClick={handleSaveSubCategory} className="w-full">
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
                ? 'This will delete the category and all its sub-categories. This action cannot be undone.'
                : 'This will delete the sub-category. This action cannot be undone.'}
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
    </div>
  );
}
