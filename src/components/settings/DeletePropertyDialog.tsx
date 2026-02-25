import { useState } from 'react';
import { Property } from '@/lib/propertyContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeletePropertyDialogProps {
  property: Property;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeletePropertyDialog({ property, open, onClose, onDeleted }: DeletePropertyDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmName === property.name;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      // Delete access records first (cascade should handle, but be explicit)
      await supabase.from('user_property_access').delete().eq('property_id', property.id);
      
      const { error } = await supabase.from('properties').delete().eq('id', property.id);
      if (error) throw error;

      toast.success(`${property.name} deleted`);
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete property');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete Property
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Type the property name to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm">
            You are about to delete <strong>{property.name}</strong>. This will remove all user assignments for this property.
          </p>
          <div>
            <Label>Type "{property.name}" to confirm</Label>
            <Input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={property.name}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || deleting}>
            {deleting ? 'Deleting...' : 'Delete Property'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
