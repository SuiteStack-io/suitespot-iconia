import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X, Loader2, FileText } from 'lucide-react';

interface PassportUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  guestName: string;
}

interface Passport {
  id: string;
  passport_url: string;
  uploaded_at: string;
}

const getFileNameFromUrl = (url: string): string => {
  const parts = url.split('/');
  const fullName = parts[parts.length - 1];
  const nameWithoutTimestamp = fullName.replace(/^\d+-/, '');
  return decodeURIComponent(nameWithoutTimestamp);
};

export const PassportUploadDialog = ({
  open,
  onOpenChange,
  reservationId,
  guestName
}: PassportUploadDialogProps) => {
  const [passports, setPassports] = useState<Passport[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newlyUploadedIds, setNewlyUploadedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && reservationId) {
      fetchPassports();
      setNewlyUploadedIds([]);
    }
  }, [open, reservationId]);

  const fetchPassports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservation_passports')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('uploaded_at', { ascending: true });

      if (error) throw error;
      setPassports(data || []);
    } catch (error: any) {
      console.error('Error fetching passports:', error);
      toast.error('Failed to load passports');
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    // Extract just the path if it's a full URL (for backwards compatibility)
    let path = filePath;
    if (filePath.includes('/id-passports/')) {
      path = filePath.split('/id-passports/').pop() || filePath;
    }
    
    const { data, error } = await supabase.storage
      .from('id-passports')
      .createSignedUrl(path, 3600); // 1 hour expiry
      
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 1200;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress image'));
          },
          'image/jpeg',
          0.8
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        // Compress the image
        const compressedBlob = await compressImage(file);
        
        // Generate unique file path
        const timestamp = Date.now();
        const fileName = `${reservationId}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('id-passports')
          .upload(fileName, compressedBlob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Save to database - store file path only (not public URL since bucket is private)
        const { data: insertedData, error: dbError } = await supabase
          .from('reservation_passports')
          .insert({
            reservation_id: reservationId,
            passport_url: fileName
          })
          .select('id')
          .single();

        if (dbError) throw dbError;
        
        // Track newly uploaded IDs
        if (insertedData) {
          setNewlyUploadedIds(prev => [...prev, insertedData.id]);
        }
      }

      toast.success(`${files.length} passport${files.length > 1 ? 's' : ''} uploaded`);
      fetchPassports();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload passport');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (passport: Passport) => {
    try {
      // Extract file path from URL
      const urlParts = passport.passport_url.split('/id-passports/');
      const filePath = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage
        .from('id-passports')
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('reservation_passports')
        .delete()
        .eq('id', passport.id);

      if (error) throw error;

      // Remove from newly uploaded tracking if applicable
      setNewlyUploadedIds(prev => prev.filter(id => id !== passport.id));

      toast.success('Passport deleted');
      fetchPassports();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete passport');
    }
  };

  const handleCancel = async () => {
    // Delete all newly uploaded passports
    for (const id of newlyUploadedIds) {
      const passport = passports.find(p => p.id === id);
      if (passport) {
        try {
          const urlParts = passport.passport_url.split('/id-passports/');
          const filePath = urlParts[urlParts.length - 1];
          await supabase.storage.from('id-passports').remove([filePath]);
          await supabase.from('reservation_passports').delete().eq('id', id);
        } catch (error) {
          console.error('Error removing passport:', error);
        }
      }
    }
    setNewlyUploadedIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Passports - {guestName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Passport Grid */}
              <div className="grid grid-cols-3 gap-3">
                {passports.map((passport) => (
                  <div 
                    key={passport.id} 
                    className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden group flex flex-col items-center justify-center p-2 border"
                  >
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-center text-muted-foreground line-clamp-2 break-all">
                      {getFileNameFromUrl(passport.passport_url)}
                    </span>
                    <button
                      onClick={async () => {
                        const url = await getSignedUrl(passport.passport_url);
                        if (url) {
                          window.open(url, '_blank');
                        } else {
                          toast.error('Failed to load passport');
                        }
                      }}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(passport)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* Add Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-[3/4] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-accent/50 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Add</span>
                    </>
                  )}
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Help text */}
              <p className="text-xs text-muted-foreground text-center">
                Click the + button to upload passport photos. You can upload multiple at once.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
