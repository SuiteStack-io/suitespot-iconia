import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, GripVertical, Pencil, Trash2, Eye, EyeOff, Save } from 'lucide-react';
import { CreateFAQDialog } from './CreateFAQDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sequence_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export function FAQManagement() {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<FAQItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FAQItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchFAQItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .order('sequence_order', { ascending: true });

    if (error) {
      toast.error('Failed to load FAQ items');
      console.error(error);
    } else {
      setFaqItems(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFAQItems();
  }, []);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from('faq_items')
      .delete()
      .eq('id', deleteItem.id);

    if (error) {
      toast.error('Failed to delete FAQ item');
      console.error(error);
    } else {
      toast.success('FAQ item deleted');
      fetchFAQItems();
    }

    setDeleteItem(null);
    setIsDeleting(false);
  };

  const handleTogglePublish = async (item: FAQItem) => {
    const { error } = await supabase
      .from('faq_items')
      .update({ is_published: !item.is_published })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update FAQ item');
      console.error(error);
    } else {
      toast.success(item.is_published ? 'FAQ item unpublished' : 'FAQ item published');
      fetchFAQItems();
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...faqItems];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setFaqItems(newItems);
    setDraggedIndex(index);
    setHasOrderChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveOrder = async () => {
    setIsSaving(true);

    const updates = faqItems.map((item, index) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      sequence_order: index,
      is_published: item.is_published,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('faq_items')
        .update({ sequence_order: update.sequence_order })
        .eq('id', update.id);

      if (error) {
        toast.error('Failed to save order');
        console.error(error);
        setIsSaving(false);
        return;
      }
    }

    toast.success('Order saved successfully');
    setHasOrderChanges(false);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">FAQ Management</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ Item
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              FAQ Items ({faqItems.length})
            </h3>
            {hasOrderChanges && (
              <Button onClick={handleSaveOrder} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Order'}
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading FAQ items...
          </div>
        ) : faqItems.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No FAQ items yet. Click "Add FAQ Item" to create one.
          </div>
        ) : (
          <div className="divide-y">
            {faqItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 p-4 bg-background hover:bg-muted/50 transition-colors cursor-move ${
                  draggedIndex === index ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.question}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.answer.substring(0, 100)}...
                  </p>
                </div>

                <Badge variant={item.is_published ? 'default' : 'secondary'}>
                  {item.is_published ? 'Published' : 'Draft'}
                </Badge>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTogglePublish(item)}
                    title={item.is_published ? 'Unpublish' : 'Publish'}
                  >
                    {item.is_published ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditItem(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteItem(item)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <CreateFAQDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchFAQItems}
      />

      {editItem && (
        <CreateFAQDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          editItem={editItem}
          onSuccess={() => {
            setEditItem(null);
            fetchFAQItems();
          }}
        />
      )}

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
