import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AmenitiesManagerProps {
  unitId: string;
}

interface Amenity {
  id: string;
  name: string;
  type: string;
  description: string;
  distance_meters: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
}

const AMENITY_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "grocery", label: "Grocery Store" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "hospital", label: "Hospital" },
  { value: "gym", label: "Gym" },
  { value: "park", label: "Park" },
  { value: "museum", label: "Museum" },
  { value: "shopping", label: "Shopping" },
  { value: "transport", label: "Public Transport" },
  { value: "other", label: "Other" },
];

const AmenitiesManager = ({ unitId }: AmenitiesManagerProps) => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("restaurant");
  const [description, setDescription] = useState("");
  const [distance, setDistance] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("");

  useEffect(() => {
    fetchAmenities();
  }, [unitId]);

  const fetchAmenities = async () => {
    try {
      const { data, error } = await supabase
        .from("nearby_amenities")
        .select("*")
        .eq("unit_id", unitId)
        .order("distance_meters");

      if (error) throw error;
      setAmenities(data || []);
    } catch (error) {
      console.error("Error fetching amenities:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setType("restaurant");
    setDescription("");
    setDistance("");
    setLatitude("");
    setLongitude("");
    setAddress("");
    setPhone("");
    setWebsite("");
    setHours("");
  };

  const handleAddAmenity = async () => {
    if (!name || !description || !distance) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("nearby_amenities").insert({
        unit_id: unitId,
        name,
        type,
        description,
        distance_meters: parseInt(distance),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address || null,
        phone: phone || null,
        website: website || null,
        hours: hours || null,
      });

      if (error) throw error;

      toast.success("Amenity added successfully");
      resetForm();
      setIsAddDialogOpen(false);
      fetchAmenities();
    } catch (error: any) {
      console.error("Error adding amenity:", error);
      toast.error(error.message || "Failed to add amenity");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAmenity = async (id: string) => {
    if (!confirm("Are you sure you want to delete this amenity?")) return;

    try {
      const { error } = await supabase
        .from("nearby_amenities")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Amenity deleted");
      fetchAmenities();
    } catch (error: any) {
      console.error("Error deleting amenity:", error);
      toast.error(error.message || "Failed to delete amenity");
    }
  };

  const handleGetDirections = (amenity: Amenity) => {
    if (amenity.latitude && amenity.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${amenity.latitude},${amenity.longitude}`;
      window.open(url, "_blank");
    } else if (amenity.address) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(amenity.address)}`;
      window.open(url, "_blank");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Nearby Amenities
        </CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Amenity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Nearby Amenity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Amenity name"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AMENITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="distance">Distance (meters) *</Label>
                <Input
                  id="distance"
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="30.0444"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="31.2357"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 123 456 7890"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="hours">Hours</Label>
                <Input
                  id="hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Mon-Fri: 9AM-6PM"
                />
              </div>

              <Button onClick={handleAddAmenity} disabled={loading} className="w-full">
                {loading ? "Adding..." : "Add Amenity"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {amenities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No amenities added yet
          </div>
        ) : (
          <div className="space-y-4">
            {amenities.map((amenity) => (
              <div key={amenity.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{amenity.name}</h4>
                    <p className="text-sm text-muted-foreground capitalize">{amenity.type}</p>
                  </div>
                  <div className="flex gap-2">
                    {(amenity.latitude || amenity.address) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGetDirections(amenity)}
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteAmenity(amenity.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm mb-2">{amenity.description}</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>📍 {amenity.distance_meters}m away</p>
                  {amenity.address && <p>{amenity.address}</p>}
                  {amenity.phone && <p>📞 {amenity.phone}</p>}
                  {amenity.hours && <p>🕐 {amenity.hours}</p>}
                  {amenity.website && (
                    <a
                      href={amenity.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Visit website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AmenitiesManager;
