import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import suitespotLogo from '@/assets/suitespot-logo.png';

interface ParsedReservation {
  bookingReference: string;
  guestNames: string[];
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  numberOfGuests: number;
  contactEmail?: string;
  contactPhone?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  notes?: string;
  unitId?: string;
  nights?: number;
}

const BookingComReservations = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedReservation | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching units:', error);
    } else {
      setUnits(data || []);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result?.toString().split(',')[1];
        
        if (!base64) {
          throw new Error('Failed to read file');
        }

        // Call edge function to parse
        const { data, error } = await supabase.functions.invoke('parse-reservation-screenshot', {
          body: { imageBase64: base64 }
        });

        if (error) throw error;

        if (data.success) {
          setParsedData(data.data);
          setShowPreview(true);
        } else {
          throw new Error(data.error || 'Failed to parse reservation');
        }
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };

      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error('Error parsing screenshot:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to parse reservation screenshot',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (!parsedData) return;

    setCreating(true);

    try {
      // Create reservation
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          booking_reference: parsedData.bookingReference,
          guest_names: parsedData.guestNames,
          check_in_date: parsedData.checkInDate,
          check_out_date: parsedData.checkOutDate,
          unit_id: parsedData.unitId,
          number_of_guests: parsedData.numberOfGuests,
          contact_email: parsedData.contactEmail,
          contact_phone: parsedData.contactPhone,
          total_price: parsedData.totalPrice,
          currency: parsedData.currency || 'USD',
          adults: parsedData.adults || parsedData.numberOfGuests,
          children: parsedData.children || 0,
          nights: parsedData.nights,
          notes: parsedData.notes,
          status: 'confirmed',
          source: 'booking.com',
          channel: 'Booking.com'
        })
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Send confirmation email if email is available
      if (parsedData.contactEmail && reservation) {
        try {
          await supabase.functions.invoke('send-reservation-notification', {
            body: {
              reservation: {
                ...reservation,
                guest_names: parsedData.guestNames,
                contact_email: parsedData.contactEmail
              }
            }
          });
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Don't fail the whole operation if email fails
        }
      }

      toast({
        title: 'Success',
        description: 'Reservation created successfully',
      });

      setShowPreview(false);
      setParsedData(null);
      
      // Reset file input
      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getUnitName = (unitId?: string) => {
    if (!unitId) return 'No room matched';
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.name : 'Unknown room';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Booking.com Reservations</h1>
            <p className="text-sm text-muted-foreground">Upload and import reservations from screenshots</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Reservation Screenshot</CardTitle>
            <CardDescription>
              Upload a screenshot from Booking.com and we'll automatically extract the reservation details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="screenshot-upload">Reservation Screenshot</Label>
                <div className="mt-2">
                  <Input
                    id="screenshot-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing screenshot with AI...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Take a screenshot of the reservation details from Booking.com</li>
                <li>Upload the screenshot using the form above</li>
                <li>Our AI will automatically extract all reservation details</li>
                <li>Review and confirm the extracted information</li>
                <li>The reservation will be created and an email will be sent to the guest</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Reservation Details</DialogTitle>
            <DialogDescription>
              Please review the extracted information before creating the reservation
            </DialogDescription>
          </DialogHeader>

          {parsedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Booking Reference</Label>
                  <p className="font-medium">{parsedData.bookingReference}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Room</Label>
                  <p className="font-medium">{parsedData.roomName}</p>
                  <p className={`text-sm ${parsedData.unitId ? 'text-green-600' : 'text-yellow-600'}`}>
                    {parsedData.unitId ? `✓ Matched: ${getUnitName(parsedData.unitId)}` : '⚠ No room matched'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Check-in</Label>
                  <p className="font-medium">{new Date(parsedData.checkInDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Check-out</Label>
                  <p className="font-medium">{new Date(parsedData.checkOutDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Guest Names</Label>
                <p className="font-medium">{parsedData.guestNames.join(', ')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Number of Guests</Label>
                  <p className="font-medium">{parsedData.numberOfGuests}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nights</Label>
                  <p className="font-medium">{parsedData.nights}</p>
                </div>
              </div>

              {parsedData.contactEmail && (
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-medium">{parsedData.contactEmail}</p>
                </div>
              )}

              {parsedData.contactPhone && (
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="font-medium">{parsedData.contactPhone}</p>
                </div>
              )}

              {parsedData.totalPrice && (
                <div>
                  <Label className="text-xs text-muted-foreground">Total Price</Label>
                  <p className="font-medium">
                    {parsedData.currency} {parsedData.totalPrice}
                  </p>
                </div>
              )}

              {parsedData.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm">{parsedData.notes}</p>
                </div>
              )}

              {!parsedData.unitId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠ Warning: Could not automatically match the room. The reservation will be created without a room assignment.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReservation} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Confirm & Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingComReservations;