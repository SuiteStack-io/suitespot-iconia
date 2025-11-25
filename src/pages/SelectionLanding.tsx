import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelectionAuth } from "@/lib/selectionAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { PropertyDetailsModal } from "@/components/PropertyDetailsModal";

interface Unit {
  id: string;
  name: string;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  photos: string[] | null;
  unit_size: string | null;
  view: string | null;
  address: string | null;
  features: string[] | null;
}

export default function SelectionLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { account, loading: authLoading, sessionExpired, checkSessionExpiry } = useSelectionAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  useEffect(() => {
    if (!authLoading && !account) {
      navigate(`/selection-login/${token}`);
    }
  }, [account, authLoading, token, navigate]);

  useEffect(() => {
    if (account) {
      fetchSelectedUnits();
      updateTimeRemaining();
      
      const interval = setInterval(() => {
        if (checkSessionExpiry()) {
          clearInterval(interval);
        } else {
          updateTimeRemaining();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [account]);

  const updateTimeRemaining = () => {
    if (!account?.session_expires_at) return;
    
    const expiryTime = new Date(account.session_expires_at).getTime();
    const now = new Date().getTime();
    const diff = expiryTime - now;
    
    if (diff <= 0) {
      setTimeRemaining("Expired");
      return;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  };

  const fetchSelectedUnits = async () => {
    if (!account) return;

    try {
      // Get KYC link ID from selection account
      const { data: accountData, error: accountError } = await supabase
        .from("selection_accounts")
        .select("kyc_link_id")
        .eq("landing_page_token", token)
        .single();

      if (accountError) throw accountError;

      // Get selected unit IDs
      const { data: accessData, error: accessError } = await supabase
        .from("guest_inventory_access")
        .select("unit_id")
        .eq("kyc_link_id", accountData.kyc_link_id);

      if (accessError) throw accessError;

      const unitIds = accessData.map(d => d.unit_id);

      // Fetch unit details
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, name, beds, baths, max_guests, photos, unit_size, view, address, features")
        .in("id", unitIds);

      if (unitsError) throw unitsError;

      setUnits(unitsData || []);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4"
        style={{
          backgroundImage: "url('/lovable-uploads/26e5c95e-58d2-4c28-82de-1ee3dcc6e70f.png')"
        }}
      >
        <div className="bg-background/95 backdrop-blur-sm rounded-2xl shadow-2xl p-12 max-w-md text-center border border-border/50">
          <h1 className="text-4xl font-serif font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>
            Session Expired
          </h1>
          <p className="text-lg text-muted-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your viewing session has expired for security reasons. Please contact us if you need extended access to the properties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/lovable-uploads/26e5c95e-58d2-4c28-82de-1ee3dcc6e70f.png')",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none"
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Screenshot protection overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
        <div className="text-white/10 text-6xl font-bold rotate-45 select-none">
          PRIVATE & CONFIDENTIAL
        </div>
      </div>

      {/* Time remaining indicator */}
      <div className="fixed top-4 right-4 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-40">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{timeRemaining}</span>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-12 bg-background/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-3xl mx-auto border border-border/50">
          <h1 className="text-5xl md:text-6xl font-serif font-semibold mb-3" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>
            Welcome to Your Almaza Selection
          </h1>
          <p className="text-xl text-muted-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Here are the homes we've curated for your stay
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="bg-background/95 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden border border-border/50 hover:shadow-2xl transition-shadow"
              >
                {unit.photos && unit.photos.length > 0 && (
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    <img
                      src={unit.photos[0]}
                      alt={unit.name}
                      className="w-full h-64 object-cover transition-transform group-hover:scale-105"
                      draggable="false"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-lg font-semibold">
                        View Details
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-6">
                  <h2 className="text-2xl font-serif font-semibold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {unit.name}
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {unit.beds && <p>Bedrooms: {unit.beds}</p>}
                    {unit.baths && <p>Bathrooms: {unit.baths}</p>}
                    {unit.max_guests && <p>Max Guests: {unit.max_guests}</p>}
                    {unit.unit_size && <p>Size: {unit.unit_size}</p>}
                    {unit.view && <p>View: {unit.view}</p>}
                    {unit.address && <p className="pt-2">{unit.address}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12 bg-background/95 backdrop-blur-sm rounded-xl p-6 max-w-2xl mx-auto border border-border/50">
          <p className="text-sm text-muted-foreground">
            This session will expire in {timeRemaining}
          </p>
        </div>
      </div>

      {/* Property Details Modal */}
      {selectedUnit && (
        <PropertyDetailsModal
          open={!!selectedUnit}
          onClose={() => setSelectedUnit(null)}
          property={selectedUnit}
        />
      )}
    </div>
  );
}
