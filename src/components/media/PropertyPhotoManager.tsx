import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Upload } from "lucide-react";
import MediaUploader from "./MediaUploader";
import MediaGallery from "./MediaGallery";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PropertyPhotoManagerProps {
  unitId: string;
  unitName: string;
}

const PropertyPhotoManager = ({ unitId, unitName }: PropertyPhotoManagerProps) => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setIsUploadOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Property Photos - {unitName}
        </CardTitle>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Photos
        </Button>
      </CardHeader>
      <CardContent>
        <MediaGallery
          unitId={unitId}
          bucketId="property-photos"
          onRefresh={refreshKey}
        />
      </CardContent>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Photos for {unitName}</DialogTitle>
          </DialogHeader>
          <MediaUploader
            unitId={unitId}
            bucketId="property-photos"
            onUploadComplete={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PropertyPhotoManager;
