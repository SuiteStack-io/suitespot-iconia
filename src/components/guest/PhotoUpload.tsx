import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, X, Loader2, ImageIcon } from "lucide-react";

interface PhotoUploadProps {
  onPhotosUploaded: (urls: string[]) => void;
  maxPhotos?: number;
}

interface UploadedPhoto {
  url: string;
  preview: string;
}

export function PhotoUpload({ onPhotosUploaded, maxPhotos = 5 }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Canvas to Blob conversion failed"));
              }
            },
            "image/jpeg",
            0.8
          );
        };
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed max
    if (photos.length + files.length > maxPhotos) {
      toast.error(`You can only upload up to ${maxPhotos} photos`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    const newPhotos: UploadedPhoto[] = [];
    const filesArray = Array.from(files);
    
    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        // Update progress for this file
        const baseProgress = (i / filesArray.length) * 100;
        setUploadProgress(baseProgress);

        // Compress image
        const compressedBlob = await compressImage(file);
        setUploadProgress(baseProgress + 20);

        // Create preview
        const previewUrl = URL.createObjectURL(compressedBlob);

        // Upload to Supabase
        const fileName = `${Date.now()}-${i}-${file.name}`;
        setUploadProgress(baseProgress + 40);

        const { data, error } = await supabase.storage
          .from("guest-ticket-photos")
          .upload(fileName, compressedBlob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("guest-ticket-photos")
          .getPublicUrl(data.path);

        newPhotos.push({
          url: urlData.publicUrl,
          preview: previewUrl,
        });
        
        setUploadProgress(baseProgress + 100 / filesArray.length);
      }

      const updatedPhotos = [...photos, ...newPhotos];
      setPhotos(updatedPhotos);
      onPhotosUploaded(updatedPhotos.map(p => p.url));
      toast.success(`${newPhotos.length} photo(s) uploaded successfully`);
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error(error.message || "Failed to upload photos");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    onPhotosUploaded(updatedPhotos.map(p => p.url));
    toast.success("Photo removed");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Photos (Optional) - {photos.length}/{maxPhotos}
      </label>
      
      {/* Display uploaded photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo.preview}
                alt={`Upload ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setPreviewPhoto(photo.preview)}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {photos.length < maxPhotos && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                {photos.length > 0 ? "Add More Photos" : "Add Photos"}
              </>
            )}
          </Button>
          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(uploadProgress)}% uploaded
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upload photos to help us understand the issue better. Tap to view full size.
      </p>

      {/* Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-4xl">
          {previewPhoto && (
            <img
              src={previewPhoto}
              alt="Full size preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
