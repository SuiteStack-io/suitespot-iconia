import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sequence_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateFAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: FAQItem | null;
  onSuccess: () => void;
}

export function CreateFAQDialog({
  open,
  onOpenChange,
  editItem,
  onSuccess,
}: CreateFAQDialogProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editItem) {
      setQuestion(editItem.question);
      setAnswer(editItem.answer);
      setIsPublished(editItem.is_published);
    } else {
      setQuestion('');
      setAnswer('');
      setIsPublished(true);
    }
  }, [editItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || !answer.trim()) {
      toast.error('Please fill in both question and answer');
      return;
    }

    setIsSubmitting(true);

    if (editItem) {
      // Update existing item
      const { error } = await supabase
        .from('faq_items')
        .update({
          question: question.trim(),
          answer: answer.trim(),
          is_published: isPublished,
        })
        .eq('id', editItem.id);

      if (error) {
        toast.error('Failed to update FAQ item');
        console.error(error);
      } else {
        toast.success('FAQ item updated');
        onSuccess();
        onOpenChange(false);
      }
    } else {
      // Get the highest sequence_order
      const { data: existingItems } = await supabase
        .from('faq_items')
        .select('sequence_order')
        .order('sequence_order', { ascending: false })
        .limit(1);

      const nextOrder = existingItems && existingItems.length > 0 
        ? existingItems[0].sequence_order + 1 
        : 0;

      // Create new item
      const { error } = await supabase.from('faq_items').insert({
        question: question.trim(),
        answer: answer.trim(),
        is_published: isPublished,
        sequence_order: nextOrder,
      });

      if (error) {
        toast.error('Failed to create FAQ item');
        console.error(error);
      } else {
        toast.success('FAQ item created');
        onSuccess();
        onOpenChange(false);
      }
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editItem ? 'Edit FAQ Item' : 'Add New FAQ Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter the question..."
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter the answer..."
              rows={6}
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
            <Label htmlFor="published" className="cursor-pointer">
              Published (visible on public FAQ page)
            </Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : editItem
                ? 'Update FAQ Item'
                : 'Create FAQ Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
