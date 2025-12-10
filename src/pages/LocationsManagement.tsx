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

const LocationsManagement = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, unit_number, address")
        .order("name");

      if (error) throw error;
      
      setUnits(data || []);
      if (data && data.length > 0) {
        setSelectedUnitId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedUnit = units.find(u => u.id === selectedUnitId);

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

        {units.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No properties found. Please add properties first.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Select Property</label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} {unit.unit_number && `(${unit.unit_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUnit && (
              <div className="space-y-6">
                <LocationManager
                  unitId={selectedUnit.id}
                  unitName={selectedUnit.name}
                />
                <AmenitiesManager unitId={selectedUnit.id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LocationsManagement;
