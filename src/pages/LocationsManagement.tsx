import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Map, ArrowLeft } from "lucide-react";
import LocationManager from "@/components/admin/LocationManager";
import AmenitiesManager from "@/components/admin/AmenitiesManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";

const LOCATION_DISPLAY_NAMES: Record<string, string> = {
  ICONIA: "ICONIA Zamalek - Boutique Stay & Wellness Residences",
};

interface PropertyEntry {
  location: string;
  displayName: string;
  representativeUnitId: string;
}

const LocationsManagement = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyEntry[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, location")
        .not("location", "is", null)
        .order("location");

      if (error) throw error;

      // Group by location, pick first unit ID as representative
      const seen: Record<string, string> = {};
      for (const unit of data || []) {
        if (unit.location && !seen[unit.location]) {
          seen[unit.location] = unit.id;
        }
      }

      const entries: PropertyEntry[] = Object.entries(seen).map(
        ([location, id]) => ({
          location,
          displayName: LOCATION_DISPLAY_NAMES[location] || location,
          representativeUnitId: id,
        })
      );

      setProperties(entries);
      if (entries.length > 0) {
        setSelectedLocation(entries[0].location);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedProperty = properties.find(p => p.location === selectedLocation);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <SlideMenu userRole={userRole} />
          
          {/* Mobile back button - icon only */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="md:hidden"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Desktop back button with text */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Location & Maps Management</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage property locations and nearby amenities
            </p>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No properties found. Please add properties first.
          </div>
        ) : (
          <>
            {properties.length > 1 && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">Select Property</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.location} value={p.location}>
                        {p.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProperty && (
              <div className="space-y-6">
                {properties.length === 1 && (
                  <p className="text-lg font-medium">{selectedProperty.displayName}</p>
                )}
                <LocationManager
                  unitId={selectedProperty.representativeUnitId}
                  unitName={selectedProperty.displayName}
                />
                <AmenitiesManager unitId={selectedProperty.representativeUnitId} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LocationsManagement;
