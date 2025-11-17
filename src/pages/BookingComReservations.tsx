import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  commissionableAmount?: number;
  commissionAmount?: number;
  nationality?: string;
  preferredLanguage?: string;
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [manualUnitId, setManualUnitId] = useState<string>('');
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);

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

  const fetchAvailableUnits = async (checkInDate: string, checkOutDate: string) => {
    try {
      // Fetch all units
      const { data: allUnits, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('status', 'available')
        .order('name');

      if (unitsError) throw unitsError;

      // Fetch reservations that overlap with the date range
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('unit_id')
        .eq('status', 'confirmed')
        .or(`and(check_in_date.lte.${checkOutDate},check_out_date.gte.${checkInDate})`);

      if (reservationsError) throw reservationsError;

      // Fetch blocked dates that overlap with the date range
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('unit_id')
        .gte('blocked_date', checkInDate)
        .lte('blocked_date', checkOutDate);

      if (blockedError) throw blockedError;

      // Get unit IDs that are unavailable
      const unavailableUnitIds = new Set([
        ...reservations.map(r => r.unit_id).filter(Boolean),
        ...blockedDates.map(b => b.unit_id).filter(Boolean)
      ]);

      // Filter out unavailable units
      const available = allUnits?.filter(unit => !unavailableUnitIds.has(unit.id)) || [];
      setAvailableUnits(available);
    } catch (error) {
      console.error('Error fetching available units:', error);
      setAvailableUnits([]);
    }
  };

  const processFile = async (file: File) => {
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
    setUploadProgress(0);
    setUploadComplete(false);
    setScreenshotFile(file); // Store the file for later upload

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setUploadProgress(30);
          const base64 = event.target?.result?.toString().split(',')[1];
          
          if (!base64) {
            throw new Error('Failed to read file');
          }

          setUploadProgress(50);
          
          // Call edge function to parse
          const { data, error } = await supabase.functions.invoke('parse-reservation-screenshot', {
            body: { imageBase64: base64 }
          });

          setUploadProgress(80);

          if (error) throw error;

          if (data.success) {
            setUploadProgress(100);
            setUploadComplete(true);
            
            setTimeout(() => {
              setParsedData(data.data);
              setManualUnitId(''); // Reset manual selection
              // Fetch available units for the date range
              if (data.data.checkInDate && data.data.checkOutDate) {
                fetchAvailableUnits(data.data.checkInDate, data.data.checkOutDate);
              }
              setShowPreview(true);
              setUploadComplete(false);
              setUploading(false);
            }, 1000);
          } else {
            throw new Error(data.error || 'Failed to parse reservation');
          }
        } catch (error: any) {
          console.error('Error parsing screenshot:', error);
          setUploadProgress(0);
          setUploadComplete(false);
          setUploading(false);
          toast({
            title: 'Error',
            description: error.message || 'Failed to parse reservation screenshot',
            variant: 'destructive',
          });
        }
      };

      reader.onerror = () => {
        setUploadProgress(0);
        setUploadComplete(false);
        setUploading(false);
        toast({
          title: 'Error',
          description: 'Failed to read file',
          variant: 'destructive',
        });
      };

      setUploadProgress(10);
      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error('Error processing file:', error);
      setUploadProgress(0);
      setUploadComplete(false);
      setUploading(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process file',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  const handleConfirmReservation = async () => {
    if (!parsedData) return;

    setCreating(true);

    try {
      // Upload screenshot to storage first
      let screenshotUrl: string | null = null;
      if (screenshotFile) {
        const fileExt = screenshotFile.name.split('.').pop();
        const fileName = `${parsedData.bookingReference}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('booking-screenshots')
          .upload(filePath, screenshotFile);

        if (uploadError) {
          console.error('Error uploading screenshot:', uploadError);
          // Continue anyway, screenshot is not critical
        } else {
          const { data: urlData } = supabase.storage
            .from('booking-screenshots')
            .getPublicUrl(filePath);
          screenshotUrl = urlData.publicUrl;
        }
      }

      // Calculate price per night
      const checkIn = new Date(parsedData.checkInDate);
      const checkOut = new Date(parsedData.checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const pricePerNight = parsedData.totalPrice && nights > 0 ? parsedData.totalPrice / nights : null;
      
      // Calculate commission rate
      const commissionRate = parsedData.commissionAmount && parsedData.totalPrice 
        ? (parsedData.commissionAmount / parsedData.totalPrice) * 100 
        : null;

      // Use manual unit selection if available, otherwise use parsed unit
      const selectedUnitId = manualUnitId || parsedData.unitId;

      // Create reservation (nights will be calculated automatically by database)
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          booking_reference: parsedData.bookingReference,
          guest_names: parsedData.guestNames || [],
          guest_nationality: parsedData.nationality || null,
          check_in_date: parsedData.checkInDate,
          check_out_date: parsedData.checkOutDate,
          unit_id: selectedUnitId,
          number_of_guests: parsedData.numberOfGuests,
          contact_email: parsedData.contactEmail,
          contact_phone: parsedData.contactPhone,
          total_price: parsedData.totalPrice,
          price_per_night: pricePerNight,
          currency: parsedData.currency || 'USD',
          adults: parsedData.adults || parsedData.numberOfGuests,
          children: parsedData.children || 0,
          commission_rate: commissionRate,
          commission_amount: parsedData.commissionAmount,
          net_revenue: parsedData.commissionableAmount,
          notes: parsedData.notes,
          status: 'confirmed',
          source: 'booking.com',
          channel: 'Booking.com',
          preferred_language: parsedData.preferredLanguage || null,
          booking_screenshot_url: screenshotUrl
        })
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Send confirmation email if email is available
      if (parsedData.contactEmail && reservation) {
        try {
          await supabase.functions.invoke('send-reservation-notification', {
            body: {
              reservationId: parsedData.bookingReference,
              guestNames: parsedData.guestNames || [],
              checkIn: parsedData.checkInDate,
              checkOut: parsedData.checkOutDate,
              unitName: parsedData.roomName, // Use Booking.com room name (e.g., "Double Room with Terrace")
              unitType: '',
              totalPrice: parsedData.totalPrice || 0,
              numberOfGuests: parsedData.numberOfGuests,
              adults: parsedData.adults || parsedData.numberOfGuests,
              children: parsedData.children || 0,
              source: 'Booking.com',
              notes: parsedData.notes || null,
              guestNationality: parsedData.nationality || null,
              customerEmail: parsedData.contactEmail,
              customerPhone: parsedData.contactPhone || null,
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
      setScreenshotFile(null);
      
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
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="screenshot-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Drop your screenshot here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports: PNG, JPG, JPEG
                    </p>
                  </div>
                </Label>
                <Input
                  id="screenshot-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>

              {uploading && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-3 bg-secondary" />
                    <p className="text-xs text-center text-muted-foreground font-medium">{uploadProgress}%</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    {uploadComplete ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Upload complete! Processing reservation...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading and analyzing screenshot...</span>
                      </>
                    )}
                  </div>
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
                  <Label className="text-xs text-muted-foreground">Room from Screenshot</Label>
                  <p className="font-medium">{parsedData.roomName}</p>
                  <p className={`text-sm ${parsedData.unitId ? 'text-green-600' : 'text-yellow-600'}`}>
                    {parsedData.unitId ? `✓ Auto-matched: ${getUnitName(parsedData.unitId)}` : '⚠ Not auto-matched'}
                  </p>
                </div>
              </div>

              {/* Manual Room Selection */}
              <div>
                <Label className="text-sm font-medium">Select Room</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {parsedData.unitId 
                    ? 'Room was auto-matched, but you can change it below if needed.' 
                    : 'Please manually select a room for this reservation.'}
                </p>
                <Select 
                  value={manualUnitId || parsedData.unitId || ''} 
                  onValueChange={setManualUnitId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a room..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No available rooms for these dates
                      </SelectItem>
                    ) : (
                      availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} {unit.unit_number && `(${unit.unit_number})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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

              {parsedData.nationality && (
                <div>
                  <Label className="text-xs text-muted-foreground">Nationality</Label>
                  <p className="font-medium">{parsedData.nationality}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  {parsedData.preferredLanguage && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Preferred Language</Label>
                      <p className="font-medium">{parsedData.preferredLanguage}</p>
                    </div>
                  )}

                  {parsedData.contactEmail && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="font-medium break-all">{parsedData.contactEmail}</p>
                    </div>
                  )}

                  {parsedData.contactPhone && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="font-medium">{parsedData.contactPhone}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {parsedData.totalPrice && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Total Price</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.totalPrice}
                      </p>
                    </div>
                  )}

                  {parsedData.commissionableAmount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Net Revenue (Commissionable Amount)</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.commissionableAmount}
                      </p>
                    </div>
                  )}

                  {parsedData.commissionAmount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Commission & Charges</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.commissionAmount}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {parsedData.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm">{parsedData.notes}</p>
                </div>
              )}

              {!parsedData.unitId && !manualUnitId && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠ Error: No room selected. Please select a room from the dropdown above to continue.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={creating}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReservation} 
              disabled={creating || (!parsedData.unitId && !manualUnitId)}
            >
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