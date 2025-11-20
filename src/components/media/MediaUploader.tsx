import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MediaUploaderProps {
  unitId?: string;
  bucketId: "property-photos" | "property-documents";
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedTypes?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  preview?: string;
}

const MediaUploader = ({
  unitId,
  bucketId,
  onUploadComplete,
  maxFiles = 10,
  acceptedTypes = bucketId === "property-photos" 
    ? "image/jpeg,image/jpg,image/png,image/webp"
    : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}: MediaUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const filesWithPreview = files.map(file => ({
      file,
      progress: 0,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setUploadingFiles(filesWithPreview);
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadingFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (let i = 0; i < uploadingFiles.length; i++) {
        const uploadFile = uploadingFiles[i];
        const file = uploadFile.file;
        
        // Generate unique file path
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomString}.${fileExt}`;
        const filePath = unitId ? `${unitId}/${fileName}` : fileName;

        // Update progress
        setUploadingFiles(prev => 
          prev.map((f, idx) => idx === i ? { ...f, progress: 50 } : f)
        );

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(bucketId)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { error: dbError } = await supabase
          .from("media_library")
          .insert({
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            bucket_id: bucketId,
            unit_id: unitId || null,
            uploaded_by: user?.id,
            title: title || file.name,
            description: description || null,
            tags: tags ? tags.split(',').map(t => t.trim()) : null,
          });

        if (dbError) throw dbError;

        // Update progress to complete
        setUploadingFiles(prev => 
          prev.map((f, idx) => idx === i ? { ...f, progress: 100 } : f)
        );
      }

      toast.success(`${uploadingFiles.length} file(s) uploaded successfully`);
      
      // Reset form
      setUploadingFiles([]);
      setTitle("");
      setDescription("");
      setTags("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      onUploadComplete?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="file-upload">Select Files</Label>
        <Input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          disabled={uploading}
          className="mt-1"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Max {maxFiles} files, {bucketId === "property-photos" ? "10MB" : "50MB"} each
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <Label>Selected Files</Label>
          {uploadingFiles.map((uploadFile, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {uploadFile.preview ? (
                    <img
                      src={uploadFile.preview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {uploadFile.progress > 0 && (
                      <Progress value={uploadFile.progress} className="mt-2" />
                    )}
                  </div>
                  {!uploading && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <>
          <div>
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your media a title"
              disabled={uploading}
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              disabled={uploading}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma separated tags"
              disabled={uploading}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : `Upload ${uploadingFiles.length} File(s)`}
          </Button>
        </>
      )}
    </div>
  );
};

export default MediaUploader;
