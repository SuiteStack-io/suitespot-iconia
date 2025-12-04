import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

interface SlideshowManagerProps {
  tableName: 'slideshow_images' | 'our_story_slideshow';
  bucketName: string;
  title: string;
}

export function SlideshowManager({ tableName, bucketName, title }: SlideshowManagerProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchImages();
  }, [tableName]);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    const MAX_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 3MB',
        variant: 'destructive',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      setUploadProgress(100);

      const nextOrder = images.length > 0 
        ? Math.max(...images.map(img => img.sequence_order)) + 1 
        : 0;

      const { error: dbError } = await supabase
        .from(tableName)
        .insert({
          image_url: publicUrl,
          sequence_order: nextOrder,
        });

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });

      fetchImages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await uploadFile(files[0]);
    event.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOverUpload = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    try {
      let filePath: string;
      
      if (imageUrl.startsWith('http')) {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        filePath = pathParts[pathParts.length - 1];
      } else {
        const pathParts = imageUrl.split('/');
        filePath = pathParts[pathParts.length - 1];
      }

      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });

      fetchImages();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    try {
      const updates = images.map((img, index) => ({
        id: img.id,
        sequence_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from(tableName)
          .update({ sequence_order: update.sequence_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Slideshow order saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button onClick={handleSave}>Save Order</Button>
      </div>

      <Card 
        className={`p-6 transition-colors ${
          isDragging ? 'border-primary bg-primary/5 border-2 border-dashed' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOverUpload}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className={`transition-transform ${isDragging ? 'scale-110' : ''}`}>
            <Upload className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium mb-1">
              {isDragging ? 'Drop images here' : 'Drag and drop images here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click the button below to browse
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id={`image-upload-${tableName}`}
              multiple
            />
            <label htmlFor={`image-upload-${tableName}`}>
              <Button
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Browse Files
                </span>
              </Button>
            </label>
          </div>
          <span className="text-xs text-muted-foreground">
            Max size: 3MB per image • Supports JPG, PNG, WEBP
          </span>
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
      </Card>

      {/* Clean minimal image list */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
        </div>
        
        <div className="divide-y">
          {images.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              No images uploaded yet. Upload your first image to get started.
            </div>
          ) : (
            images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 px-4 py-3 cursor-move hover:bg-muted/30 transition-colors group ${
                  draggedIndex === index ? 'bg-muted/50' : ''
                }`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                
                <div className="relative flex-1">
                  <img
                    src={image.image_url}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-24 sm:h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedImage(image.image_url)}
                  />
                  
                  {/* Delete button overlay on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.id, image.image_url);
                    }}
                    className="absolute top-2 right-2 p-2 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="relative w-full">
            <img
              src={selectedImage || ''}
              alt="Preview"
              className="w-full h-auto max-h-[70vh] object-contain rounded"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
