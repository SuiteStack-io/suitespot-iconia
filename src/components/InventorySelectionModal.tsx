import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SelectionUnit } from "@/types/unit";

interface InventorySelectionModalProps {
  open: boolean;
  onClose: () => void;
  kycLinkId: string;
  guestName: string;
  onCredentialsGenerated: (credentials: {
    link: string;
    username: string;
    password: string;
  }) => void;
}

export const InventorySelectionModal = ({
  open,
  onClose,
  kycLinkId,
  guestName,
  onCredentialsGenerated
}: InventorySelectionModalProps) => {
  const [units, setUnits] = useState<SelectionUnit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUnits();
      fetchExistingSelection();
    }
  }, [open, kycLinkId]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, booking_com_name, beds, baths, max_guests, photos, unit_size, view, address, features, min_stay, price_per_night, payment_terms")
        .eq("location", "Almaza Bay")
        .eq("status", "available")
        .order("name");

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingSelection = async () => {
    try {
      const { data, error } = await supabase
        .from("guest_inventory_access")
        .select("unit_id")
        .eq("kyc_link_id", kycLinkId);

      if (error) throw error;
      if (data) {
        setSelectedUnits(new Set(data.map(d => d.unit_id)));
      }
    } catch (error) {
      console.error("Error fetching existing selection:", error);
    }
  };

  const toggleUnit = (unitId: string) => {
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  const handleGenerateLink = async () => {
    if (selectedUnits.size === 0) {
      toast.error("Please select at least one property");
      return;
    }

    setGenerating(true);

    try {
      // Generate credentials via edge function
      const { data: credentialsData, error: credError } = await supabase.functions.invoke(
        "generate-selection-credentials",
        {
          body: {
            kycLinkId,
            guestName,
            selectedUnitIds: Array.from(selectedUnits)
          }
        }
      );

      if (credError) throw credError;

      onCredentialsGenerated({
        link: `${window.location.origin}/selection/${credentialsData.token}`,
        username: credentialsData.username,
        password: credentialsData.password
      });

      toast.success("Credentials generated successfully!");
      onClose();
    } catch (error) {
      console.error("Error generating credentials:", error);
      toast.error("Failed to generate credentials");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Properties for {guestName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedUnits.has(unit.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleUnit(unit.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedUnits.has(unit.id)}
                      onCheckedChange={() => toggleUnit(unit.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      {unit.photos && unit.photos.length > 0 && (
                        <img
                          src={unit.photos[0]}
                          alt={unit.booking_com_name || unit.name}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}
                      <h3 className="font-semibold mb-1">{unit.booking_com_name || unit.name}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {unit.beds && <p>Beds: {unit.beds}</p>}
                        {unit.baths && <p>Baths: {unit.baths}</p>}
                        {unit.max_guests && <p>Max Guests: {unit.max_guests}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedUnits.size} {selectedUnits.size === 1 ? "property" : "properties"} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={generating}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateLink} disabled={generating || selectedUnits.size === 0}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Link"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
