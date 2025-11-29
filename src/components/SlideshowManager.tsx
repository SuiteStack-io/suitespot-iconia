import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  blur_placeholder?: string;
  image_url_sm?: string;
  image_url_md?: string;
  image_url_lg?: string;
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
      // Upload original image with timestamp + sanitized filename
      const fileExt = file.name.split('.').pop();
      const originalName = file.name.replace(/\.[^.]+$/, ''); // Remove extension
      const sanitizedName = originalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace special chars with hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `${timestamp}-${sanitizedName}.${fileExt}`;
      const filePath = `${fileName}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      setUploadProgress(50);

      // Call optimization edge function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucketName);
      formData.append('path', filePath);

      const { data: { session } } = await supabase.auth.getSession();
      
      const optimizeResponse = await supabase.functions.invoke('optimize-image', {
        body: formData,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      });

      setUploadProgress(80);

      if (optimizeResponse.error) {
        console.error('Optimization error:', optimizeResponse.error);
        // Continue without optimization if it fails
      }

      const optimizedUrls = optimizeResponse.data?.optimizedUrls || {};

      setUploadProgress(90);

      const nextOrder = images.length > 0 
        ? Math.max(...images.map(img => img.sequence_order)) + 1 
        : 0;

      const { error: dbError } = await supabase
        .from(tableName)
        .insert({
          image_url: publicUrl,
          sequence_order: nextOrder,
          blur_placeholder: optimizedUrls.blur_placeholder || null,
          image_url_sm: optimizedUrls.image_url_sm || null,
          image_url_md: optimizedUrls.image_url_md || null,
          image_url_lg: optimizedUrls.image_url_lg || null,
        });

      if (dbError) throw dbError;

      setUploadProgress(100);

      toast({
        title: 'Success',
        description: optimizedUrls.blur_placeholder 
          ? 'Image uploaded and optimized successfully' 
          : 'Image uploaded successfully',
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Image URL</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No images uploaded yet. Upload your first image to get started.
                </TableCell>
              </TableRow>
            ) : (
              images.map((image, index) => (
                <TableRow
                  key={image.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="cursor-move"
                >
                  <TableCell>
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <img
                      src={image.image_url}
                      alt={`Slide ${index + 1}`}
                      className="w-20 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedImage(image.image_url)}
                    />
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {image.image_url}
                  </TableCell>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(image.id, image.image_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
