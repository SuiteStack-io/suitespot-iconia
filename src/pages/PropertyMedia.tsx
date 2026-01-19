import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import PropertyPhotoManager from "@/components/media/PropertyPhotoManager";

const PropertyMedia = () => {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (unitId) fetchUnit();
  }, [unitId]);

  const fetchUnit = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("id", unitId)
        .single();

      if (error) throw error;
      setUnit(data);
    } catch (error) {
      console.error("Error fetching unit:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Property not found</p>
          <Button onClick={() => navigate("/rooms")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rooms
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rooms")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Manage Property Media</h1>
            <p className="text-muted-foreground mt-1">
              Upload and manage photos for {unit.booking_com_name || unit.name}
            </p>
          </div>
        </div>

        <PropertyPhotoManager unitId={unit.id} unitName={unit.booking_com_name || unit.name} />
      </div>
    </div>
  );
};

export default PropertyMedia;
