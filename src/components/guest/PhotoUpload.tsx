import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, X, Loader2 } from "lucide-react";

interface PhotoUploadProps {
  onPhotoUploaded: (url: string) => void;
}

export function PhotoUpload({ onPhotoUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>("");
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
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      // Compress image
      const compressedBlob = await compressImage(file);
      
      // Create preview
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPreview(previewUrl);

      // Upload to Supabase
      const fileName = `${Date.now()}-${file.name}`;
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

      onPhotoUploaded(urlData.publicUrl);
      toast.success("Photo uploaded successfully");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error(error.message || "Failed to upload photo");
      setPreview("");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview("");
    onPhotoUploaded("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Photo (Optional)</label>
      
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
                Add Photo
              </>
            )}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Upload a photo to help us understand the issue better
      </p>
    </div>
  );
}
