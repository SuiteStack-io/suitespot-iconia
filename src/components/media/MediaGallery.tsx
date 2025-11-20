import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Download, Search, Image as ImageIcon, File } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  bucket_id: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string;
}

interface MediaGalleryProps {
  unitId?: string;
  bucketId?: "property-photos" | "property-documents";
  onRefresh?: number;
}

const MediaGallery = ({ unitId, bucketId, onRefresh }: MediaGalleryProps) => {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [unitId, bucketId, onRefresh]);

  const fetchMedia = async () => {
    try {
      let query = supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false });

      if (unitId) query = query.eq("unit_id", unitId);
      if (bucketId) query = query.eq("bucket_id", bucketId);

      const { data, error } = await query;

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error("Error fetching media:", error);
      toast.error("Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (file: MediaFile) => {
    const { data } = supabase.storage
      .from(file.bucket_id)
      .getPublicUrl(file.file_path);
    return data.publicUrl;
  };

  const handleDownload = async (file: MediaFile) => {
    try {
      const { data, error } = await supabase.storage
        .from(file.bucket_id)
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDelete = async (file: MediaFile) => {
    if (!confirm(`Are you sure you want to delete "${file.file_name}"?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(file.bucket_id)
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("media_library")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast.success("File deleted successfully");
      fetchMedia();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const filteredMedia = media.filter(file =>
    file.file_name.toLowerCase().includes(search.toLowerCase()) ||
    file.title?.toLowerCase().includes(search.toLowerCase()) ||
    file.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="pl-9"
          />
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No files match your search" : "No files uploaded yet"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map((file) => (
            <Card
              key={file.id}
              className="group cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedMedia(file)}
            >
              <CardContent className="p-0">
                <div className="aspect-square relative overflow-hidden rounded-t-lg">
                  {file.mime_type.startsWith("image/") ? (
                    <img
                      src={getPublicUrl(file)}
                      alt={file.title || file.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <File className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">
                    {file.title || file.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.file_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {file.tags.slice(0, 2).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMedia && (
        <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedMedia.title || selectedMedia.file_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedMedia.mime_type.startsWith("image/") && (
                <img
                  src={getPublicUrl(selectedMedia)}
                  alt={selectedMedia.title || selectedMedia.file_name}
                  className="w-full rounded-lg"
                />
              )}
              {selectedMedia.description && (
                <p className="text-sm text-muted-foreground">{selectedMedia.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{selectedMedia.file_name}</span>
                <span>•</span>
                <span>{(selectedMedia.file_size / 1024 / 1024).toFixed(2)} MB</span>
                <span>•</span>
                <span>{new Date(selectedMedia.created_at).toLocaleDateString()}</span>
              </div>
              {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedMedia.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => handleDownload(selectedMedia)} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDelete(selectedMedia);
                    setSelectedMedia(null);
                  }}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MediaGallery;
