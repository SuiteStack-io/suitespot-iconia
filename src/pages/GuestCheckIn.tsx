import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/SignaturePad';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Reservation {
  id: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  unit_id: string | null;
  units?: {
    name: string;
    unit_number: string | null;
  } | null;
}

const GuestCheckIn = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [breachDialogOpen, setBreachDialogOpen] = useState(false);

  useEffect(() => {
    const fetchReservation = async () => {
      if (!reservationId) return;
      
      // Wait for auth to initialize
      if (authLoading) return;
      
      // Require authentication
      if (!user) {
        toast.error('Please log in to access this page');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          guest_names,
          check_in_date,
          check_out_date,
          unit_id,
          units (
            name,
            unit_number
          )
        `)
        .eq('id', reservationId)
        .single();

      if (error) {
        toast.error('Failed to load reservation');
        console.error(error);
      } else {
        setReservation(data);
        // Pre-fill with primary guest name if available
        if (data.guest_names && data.guest_names.length > 0) {
          setFullName(data.guest_names[0]);
        }
      }
      setLoading(false);
    };

    fetchReservation();
  }, [reservationId, user, authLoading, navigate]);

  const isFormValid = 
    fullName.trim() !== '' && 
    phone.trim() !== '' && 
    email.trim() !== '' && 
    signatureDataUrl !== null && 
    termsAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !reservationId || !signatureDataUrl) return;

    setSubmitting(true);

    try {
      // Convert base64 to blob for upload
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const fileName = `${reservationId}_${Date.now()}.png`;

      // Upload signature to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, {
          contentType: 'image/png',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName);

      // Save agreement to database
      const { error: insertError } = await supabase
        .from('check_in_agreements')
        .insert({
          reservation_id: reservationId,
          guest_full_name: fullName.trim(),
          guest_phone: phone.trim(),
          guest_email: email.trim(),
          signature_url: publicUrl,
          terms_accepted: true,
        });

      if (insertError) throw insertError;

      setSubmitted(true);
      toast.success('Check-in completed successfully');
    } catch (error) {
      console.error('Error submitting check-in:', error);
      toast.error('Failed to complete check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="font-playfair text-4xl font-semibold tracking-tight text-foreground mb-4">
            Reservation Not Found
          </h1>
          <p className="font-playfair text-base text-muted-foreground">
            The reservation you're looking for could not be found.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-6" />
          <h1 className="font-playfair text-4xl font-semibold tracking-tight text-foreground mb-4">
            Check-In Complete
          </h1>
          <p className="font-playfair text-base text-muted-foreground leading-relaxed">
            Thank you for completing your check-in. We hope you have a wonderful stay at SuiteSpot.
          </p>
        </div>
      </div>
    );
  }

  const unitDisplay = reservation.units 
    ? `${reservation.units.name}${reservation.units.unit_number ? ` (${reservation.units.unit_number})` : ''}`
    : 'Unassigned';

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <img 
            src="/suitespot-logo-3.png" 
            alt="SuiteSpot" 
            className="h-12 mx-auto mb-6"
          />
          <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground mb-3">
            Guest Check-In
          </h1>
          <p className="font-playfair text-2xl font-light text-muted-foreground">
            {unitDisplay} • {format(new Date(reservation.check_in_date), 'MMM d')} – {format(new Date(reservation.check_out_date), 'MMM d, yyyy')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Guest Information */}
          <section>
            <h2 className="font-playfair text-2xl font-light text-foreground mb-6">
              Guest Information
            </h2>
            <div className="space-y-5">
              <div>
                <Label htmlFor="fullName" className="font-playfair text-sm font-normal">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="font-playfair text-base mt-2"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="font-playfair text-sm font-normal">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="font-playfair text-base mt-2"
                  placeholder="Enter your phone number"
                />
              </div>
              <div>
                <Label htmlFor="email" className="font-playfair text-sm font-normal">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="font-playfair text-base mt-2"
                  placeholder="Enter your email address"
                />
              </div>
            </div>
          </section>

          {/* House Rules */}
          <section>
            <h2 className="font-playfair text-2xl font-light text-foreground mb-6">
              House Rules
            </h2>
            <div className="font-playfair text-base font-normal leading-relaxed text-foreground space-y-4">
              <p>
                To ensure a pleasant and comfortable stay for all guests, we kindly request your adherence to the following house rules:
              </p>
              <ol className="list-decimal list-outside ml-5 space-y-3">
                <li>
                  <strong>Pets:</strong> Pets are not permitted on the premises.
                </li>
                <li>
                  <strong>Events:</strong> Parties and events are strictly prohibited within guest accommodations.
                </li>
                <li>
                  <strong>Waste Disposal:</strong> Garbage must be disposed of in designated garbage rooms only. Please contact reception for assistance. Garbage bags may not be left outside room doors.
                </li>
                <li>
                  <strong>Smoking:</strong> Smoking is prohibited in all indoor areas. Designated outdoor smoking areas are available.
                </li>
                <li>
                  <strong>Alcohol:</strong> Alcoholic beverages are not permitted in common areas.
                </li>
                <li>
                  <strong>Prohibited Substances:</strong> Possession or use of illegal substances is strictly prohibited.
                </li>
              </ol>
              <p className="pt-2">
                By signing below, I acknowledge and agree to abide by the above house rules.{' '}
                <button
                  type="button"
                  onClick={() => setBreachDialogOpen(true)}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  Any violation of these terms shall result in immediate termination of this rental agreement without refund, and guests will be required to vacate the premises forthwith.
                </button>
              </p>
              <p className="text-muted-foreground">
                A minimum penalty of $100 may be assessed, subject to the nature and extent of any damages incurred.
              </p>
            </div>
          </section>

          {/* Signature */}
          <section>
            <h2 className="font-playfair text-2xl font-light text-foreground mb-2">
              Signature
            </h2>
            <p className="font-playfair text-sm text-muted-foreground mb-4">
              Please sign below to confirm your acceptance
            </p>
            <SignaturePad onSignatureChange={setSignatureDataUrl} />
          </section>

          {/* Agreement Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-1"
            />
            <Label 
              htmlFor="terms" 
              className="font-playfair text-sm font-normal leading-relaxed cursor-pointer"
            >
              I have read and agree to the house rules and terms of stay
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full font-playfair text-sm font-medium py-6"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Complete Check-In'
            )}
          </Button>
        </form>

        {/* Breach Dialog */}
        <Dialog open={breachDialogOpen} onOpenChange={setBreachDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair text-xl font-semibold">
                Terms Violation Policy
              </DialogTitle>
            </DialogHeader>
            <DialogDescription className="font-playfair text-base leading-relaxed text-foreground">
              <p className="mb-4">
                Any violation of the house rules outlined in this agreement shall result in the immediate termination of this rental agreement. In such an event:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>No refund will be provided for the remaining duration of the stay.</li>
                <li>Guests will be required to vacate the premises immediately.</li>
                <li>A minimum penalty of $100 will be assessed, with the final amount dependent on the nature and extent of any damages incurred.</li>
                <li>SuiteSpot reserves the right to pursue additional legal action if necessary.</li>
              </ul>
              <p>
                By proceeding with check-in, you acknowledge and accept these terms in their entirety.
              </p>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GuestCheckIn;
