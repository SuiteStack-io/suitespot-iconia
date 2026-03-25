import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, Trash2, GripVertical, X, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoItem {
  id: string;
  photo_url: string;
  display_order: number;
}

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  photos: PhotoItem[];
  storagePath: string;
  onPhotosChange: (photos: PhotoItem[]) => void;
  onDeletePhoto: (photoId: string, photoUrl: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  clearAllLabel?: string;
  seoPrefix?: string;
  seoSlug?: string;
}

const convertToWebP = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('WebP conversion failed')),
        'image/webp',
        0.85
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Image load failed')); };
    img.src = URL.createObjectURL(file);
  });
};

function SortablePhoto({ photo, onDelete }: { photo: PhotoItem; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 bg-muted rounded-lg border">
      <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <img src={photo.photo_url} alt="" className="h-16 w-20 object-cover rounded" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{photo.photo_url.split('/').pop()}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const PhotoUploadModal = ({
  open,
  onOpenChange,
  title,
  description,
  photos,
  storagePath,
  onPhotosChange,
  onDeletePhoto,
  onClearAll,
  clearAllLabel,
  seoPrefix,
  seoSlug,
}: PhotoUploadModalProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFiles = useCallback(async (files: File[]) => {
    const MAX_SIZE = 3 * 1024 * 1024;
    const validFiles = files.filter(f => {
      if (!f.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        toast.error(`${f.name}: only JPG, PNG, WebP allowed`);
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: exceeds 3MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const newPhotos: PhotoItem[] = [];
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const ext = file.name.split('.').pop();
        const fileName = `${storagePath}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

        const { error } = await supabase.storage.from('property-photos').upload(fileName, file, { cacheControl: '3600' });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(fileName);

        newPhotos.push({
          id: crypto.randomUUID(),
          photo_url: publicUrl,
          display_order: photos.length + i,
        });

        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100));
      }

      onPhotosChange([...photos, ...newPhotos]);
      toast.success(`${validFiles.length} photo(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [photos, storagePath, onPhotosChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex(p => p.id === active.id);
    const newIndex = photos.findIndex(p => p.id === over.id);
    const reordered = arrayMove(photos, oldIndex, newIndex).map((p, i) => ({ ...p, display_order: i }));
    onPhotosChange(reordered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <Progress value={uploadProgress} className="w-48 mx-auto" />
                <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop photos here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP · Max 3MB each</p>
              </>
            )}
          </div>

          {/* Photo grid */}
          {photos.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={photos.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {photos.map((photo, idx) => (
                    <SortablePhoto
                      key={photo.id}
                      photo={photo}
                      onDelete={async () => {
                        await onDeletePhoto(photo.id, photo.photo_url);
                        onPhotosChange(photos.filter(p => p.id !== photo.id).map((p, i) => ({ ...p, display_order: i })));
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No photos yet</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          {onClearAll && photos.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onClearAll}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {clearAllLabel || 'Clear all photos'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoUploadModal;
