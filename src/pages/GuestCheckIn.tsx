import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/SignaturePad';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Check, ChevronsUpDown, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { downloadCheckInPDF } from '@/lib/generateCheckInPDF';

const COUNTRY_CODES = [
  { code: "+1", country: "US", flag: "🇺🇸", name: "United States" },
  { code: "+1", country: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "+20", country: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "+27", country: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "+30", country: "GR", flag: "🇬🇷", name: "Greece" },
  { code: "+31", country: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "+32", country: "BE", flag: "🇧🇪", name: "Belgium" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "France" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "+40", country: "RO", flag: "🇷🇴", name: "Romania" },
  { code: "+41", country: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "+43", country: "AT", flag: "🇦🇹", name: "Austria" },
  { code: "+44", country: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+45", country: "DK", flag: "🇩🇰", name: "Denmark" },
  { code: "+46", country: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", country: "NO", flag: "🇳🇴", name: "Norway" },
  { code: "+48", country: "PL", flag: "🇵🇱", name: "Poland" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "+51", country: "PE", flag: "🇵🇪", name: "Peru" },
  { code: "+52", country: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "+53", country: "CU", flag: "🇨🇺", name: "Cuba" },
  { code: "+54", country: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "+55", country: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "+56", country: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "+57", country: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "+58", country: "VE", flag: "🇻🇪", name: "Venezuela" },
  { code: "+60", country: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "+61", country: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "+62", country: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", country: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "+64", country: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "+65", country: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "+66", country: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "+81", country: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "+82", country: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "+84", country: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "+86", country: "CN", flag: "🇨🇳", name: "China" },
  { code: "+90", country: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "+91", country: "IN", flag: "🇮🇳", name: "India" },
  { code: "+92", country: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "+93", country: "AF", flag: "🇦🇫", name: "Afghanistan" },
  { code: "+94", country: "LK", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+95", country: "MM", flag: "🇲🇲", name: "Myanmar" },
  { code: "+98", country: "IR", flag: "🇮🇷", name: "Iran" },
  { code: "+212", country: "MA", flag: "🇲🇦", name: "Morocco" },
  { code: "+213", country: "DZ", flag: "🇩🇿", name: "Algeria" },
  { code: "+216", country: "TN", flag: "🇹🇳", name: "Tunisia" },
  { code: "+218", country: "LY", flag: "🇱🇾", name: "Libya" },
  { code: "+220", country: "GM", flag: "🇬🇲", name: "Gambia" },
  { code: "+221", country: "SN", flag: "🇸🇳", name: "Senegal" },
  { code: "+234", country: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "+249", country: "SD", flag: "🇸🇩", name: "Sudan" },
  { code: "+254", country: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", country: "TZ", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", country: "UG", flag: "🇺🇬", name: "Uganda" },
  { code: "+351", country: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "+352", country: "LU", flag: "🇱🇺", name: "Luxembourg" },
  { code: "+353", country: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "+354", country: "IS", flag: "🇮🇸", name: "Iceland" },
  { code: "+358", country: "FI", flag: "🇫🇮", name: "Finland" },
  { code: "+370", country: "LT", flag: "🇱🇹", name: "Lithuania" },
  { code: "+371", country: "LV", flag: "🇱🇻", name: "Latvia" },
  { code: "+372", country: "EE", flag: "🇪🇪", name: "Estonia" },
  { code: "+380", country: "UA", flag: "🇺🇦", name: "Ukraine" },
  { code: "+420", country: "CZ", flag: "🇨🇿", name: "Czech Republic" },
  { code: "+421", country: "SK", flag: "🇸🇰", name: "Slovakia" },
  { code: "+852", country: "HK", flag: "🇭🇰", name: "Hong Kong" },
  { code: "+853", country: "MO", flag: "🇲🇴", name: "Macau" },
  { code: "+855", country: "KH", flag: "🇰🇭", name: "Cambodia" },
  { code: "+856", country: "LA", flag: "🇱🇦", name: "Laos" },
  { code: "+880", country: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+886", country: "TW", flag: "🇹🇼", name: "Taiwan" },
  { code: "+960", country: "MV", flag: "🇲🇻", name: "Maldives" },
  { code: "+961", country: "LB", flag: "🇱🇧", name: "Lebanon" },
  { code: "+962", country: "JO", flag: "🇯🇴", name: "Jordan" },
  { code: "+963", country: "SY", flag: "🇸🇾", name: "Syria" },
  { code: "+964", country: "IQ", flag: "🇮🇶", name: "Iraq" },
  { code: "+965", country: "KW", flag: "🇰🇼", name: "Kuwait" },
  { code: "+966", country: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+967", country: "YE", flag: "🇾🇪", name: "Yemen" },
  { code: "+968", country: "OM", flag: "🇴🇲", name: "Oman" },
  { code: "+971", country: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "+972", country: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "+973", country: "BH", flag: "🇧🇭", name: "Bahrain" },
  { code: "+974", country: "QA", flag: "🇶🇦", name: "Qatar" },
  { code: "+975", country: "BT", flag: "🇧🇹", name: "Bhutan" },
  { code: "+976", country: "MN", flag: "🇲🇳", name: "Mongolia" },
  { code: "+977", country: "NP", flag: "🇳🇵", name: "Nepal" },
];

interface Reservation {
  id: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  unit_id: string | null;
  units?: {
    name: string;
    booking_com_name: string | null;
    unit_number: string | null;
  } | null;
}

const GuestCheckIn = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('1990');
  
  // Helper arrays for date dropdowns
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => (currentYear - i).toString());
  
  // Computed date of birth
  const dateOfBirth = birthDay && birthMonth && birthYear
    ? new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay))
    : undefined;
  const [countryCode, setCountryCode] = useState('+20'); // Default to Egypt
  const [phone, setPhone] = useState('');
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [breachDialogOpen, setBreachDialogOpen] = useState(false);
  const [termsOfStayDialogOpen, setTermsOfStayDialogOpen] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    guestName: string;
    guestNationality: string;
    guestDateOfBirth: string;
    guestPhone: string;
    guestEmail: string;
    unitName: string;
    checkInDate: string;
    checkOutDate: string;
    signatureDataUrl: string;
    signedAt: Date;
  } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchReservation = async () => {
      if (!reservationId) return;

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          guest_names,
          check_in_date,
          check_out_date,
          unit_id,
          units!unit_id (
            name,
            booking_com_name,
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
  }, [reservationId]);

  const isFormValid = 
    fullName.trim() !== '' && 
    nationality.trim() !== '' &&
    birthDay !== '' && birthMonth !== '' && birthYear !== '' &&
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
          guest_nationality: nationality,
          guest_date_of_birth: dateOfBirth ? format(dateOfBirth, 'yyyy-MM-dd') : null,
          guest_phone: `${countryCode}${phone.trim()}`,
          guest_email: email.trim(),
          signature_url: publicUrl,
          terms_accepted: true,
        });

      if (insertError) throw insertError;

      // Update reservation status using RPC (bypasses RLS for anonymous users)
      const { data: statusUpdated, error: statusError } = await supabase
        .rpc('update_reservation_status_on_checkin', {
          p_reservation_id: reservationId
        });

      if (statusError) {
        console.error('Error updating reservation status:', statusError);
        toast.error('Check-in saved but status update failed');
      } else if (!statusUpdated) {
        console.error('Status update returned false - agreement may not exist');
        toast.error('Check-in saved but status update failed');
      }

      // Send check-in notification to all admins
      try {
        const { error: notifyError } = await supabase.functions.invoke(
          'send-checkin-notification',
          { body: { reservationId, userId: null } }
        );
        
        if (notifyError) {
          console.error('Error sending check-in notification:', notifyError);
        } else {
          console.log('Check-in notification sent to admins');
        }
      } catch (notifyErr) {
        console.error('Failed to send check-in notification:', notifyErr);
      }

      // Store data for PDF generation
      const unitDisplay = reservation?.units 
        ? `${reservation.units.booking_com_name || reservation.units.name}${reservation.units.unit_number ? ` (${reservation.units.unit_number})` : ''}`
        : 'Your Unit';
      
      setSubmittedData({
        guestName: fullName.trim(),
        guestNationality: nationality,
        guestDateOfBirth: dateOfBirth ? format(dateOfBirth, 'MMMM d, yyyy') : '',
        guestPhone: `${countryCode}${phone.trim()}`,
        guestEmail: email.trim(),
        unitName: unitDisplay,
        checkInDate: reservation?.check_in_date ? format(new Date(reservation.check_in_date), 'MMMM d, yyyy') : '',
        checkOutDate: reservation?.check_out_date ? format(new Date(reservation.check_out_date), 'MMMM d, yyyy') : '',
        signatureDataUrl: signatureDataUrl,
        signedAt: new Date(),
      });

      setSubmitted(true);
      toast.success('Check-in completed successfully');
    } catch (error) {
      console.error('Error submitting check-in:', error);
      toast.error('Failed to complete check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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
    const handleDownloadPdf = async () => {
      if (!submittedData) return;
      
      setDownloadingPdf(true);
      try {
        const fileName = `SuiteSpot_CheckIn_${submittedData.guestName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        await downloadCheckInPDF(submittedData, fileName);
        toast.success('PDF downloaded successfully');
      } catch (error) {
        console.error('Failed to generate PDF:', error);
        toast.error('Failed to generate PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-6" />
          <h1 className="font-playfair text-4xl font-semibold tracking-tight text-foreground mb-4">
            Check-In Complete
          </h1>
          <p className="font-playfair text-base text-muted-foreground leading-relaxed mb-8">
            Thank you for completing your check-in. We hope you have a wonderful stay at SuiteSpot.
          </p>
          {submittedData && (
            <Button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="font-playfair"
              size="lg"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Signed Agreement
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const unitDisplay = reservation.units 
    ? `${reservation.units.booking_com_name || reservation.units.name}${reservation.units.unit_number ? ` (${reservation.units.unit_number})` : ''}`
    : 'Unassigned';

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <img 
            src="/suitespot-logo-3.png" 
            alt="SuiteSpot" 
            className="h-12 mx-auto mb-2"
          />
          <p className="font-playfair text-base font-normal leading-relaxed text-foreground mb-6">
            SuiteSpot
          </p>
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
                <Label className="font-playfair text-sm font-normal">
                  Nationality
                </Label>
                <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={nationalityOpen}
                      className="w-full justify-between font-playfair mt-2"
                    >
                      {nationality ? (
                        <span className="flex items-center gap-2">
                          {COUNTRY_CODES.find((c) => c.name === nationality)?.flag || "🏳️"}
                          {nationality}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select your nationality</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search country..." />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {COUNTRY_CODES.map((country) => (
                            <CommandItem
                              key={`nationality-${country.country}`}
                              value={country.name}
                              onSelect={() => {
                                setNationality(country.name);
                                setNationalityOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  nationality === country.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="flex items-center gap-2">
                                <span className="text-lg">{country.flag}</span>
                                <span>{country.name}</span>
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="font-playfair text-sm font-normal">
                  Date of Birth
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Select value={birthDay} onValueChange={setBirthDay}>
                    <SelectTrigger className="font-playfair">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="bg-background max-h-[200px]">
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={birthMonth} onValueChange={setBirthMonth}>
                    <SelectTrigger className="font-playfair">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="bg-background max-h-[200px]">
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={birthYear} onValueChange={setBirthYear}>
                    <SelectTrigger className="font-playfair">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-background max-h-[200px]">
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="font-playfair text-sm font-normal">
                  Phone Number
                </Label>
                <div className="flex gap-2 mt-2">
                  <Popover open={countryCodeOpen} onOpenChange={setCountryCodeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryCodeOpen}
                        className="w-[140px] justify-between font-playfair"
                      >
                        <span className="flex items-center gap-2">
                          {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag || "🏳️"}
                          {countryCode}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search country..." />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {COUNTRY_CODES.map((country) => (
                              <CommandItem
                                key={`${country.code}-${country.country}`}
                                value={`${country.name} ${country.code}`}
                                onSelect={() => {
                                  setCountryCode(country.code);
                                  setCountryCodeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    countryCode === country.code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex items-center gap-2">
                                  <span className="text-lg">{country.flag}</span>
                                  <span>{country.name}</span>
                                  <span className="text-muted-foreground">{country.code}</span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    className="font-playfair text-base flex-1"
                    placeholder="1234567890"
                  />
                </div>
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

          {/* Check-in/Check-out Schedule & Late Checkout Policy */}
          <section>
            {/* Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <h2 className="font-playfair text-2xl font-light text-foreground">
                Check-in/Check-out Schedule
              </h2>
              <h2 className="font-playfair text-2xl font-light text-foreground text-right" dir="rtl">
                مواعيد تسجيل الوصول والمغادرة
              </h2>
            </div>

            {/* Schedule */}
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">a.</span><strong>Check-in:</strong> 3:00 PM — Date: {format(new Date(reservation.check_in_date), 'MMMM d, yyyy')}
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">أ.</span><strong>تسجيل الوصول:</strong> ٣:٠٠ مساءً — التاريخ: {format(new Date(reservation.check_in_date), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">b.</span><strong>Check-out:</strong> 12:00 PM (Noon) — Date: {format(new Date(reservation.check_out_date), 'MMMM d, yyyy')}
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">ب.</span><strong>تسجيل المغادرة:</strong> ١٢:٠٠ ظهراً — التاريخ: {format(new Date(reservation.check_out_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Late Checkout Policy Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
              <h3 className="font-playfair text-lg font-medium text-foreground">
                Late Checkout Policy
              </h3>
              <h3 className="font-playfair text-lg font-medium text-foreground text-right" dir="rtl">
                سياسة المغادرة المتأخرة
              </h3>
            </div>

            {/* Late Checkout Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground italic">
                  Late checkout is available subject to availability.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right italic" dir="rtl">
                  تتوفر خدمة المغادرة المتأخرة وفقاً للتوافر.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  • Departure between 12:00 PM and 5:00 PM: An additional charge equal to 50% of the applicable nightly rate will be applied.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  • المغادرة بين الساعة ١٢:٠٠ ظهراً و٥:٠٠ مساءً: سيتم تطبيق رسوم إضافية تعادل ٥٠٪ من سعر الليلة المعمول به.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  • Departure after 5:00 PM: An additional charge equal to one full night's rate will be applied.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  • المغادرة بعد الساعة ٥:٠٠ مساءً: سيتم تطبيق رسوم إضافية تعادل سعر ليلة كاملة.
                </p>
              </div>
            </div>
          </section>

          {/* Property Rules */}
          <section>
            {/* Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <h2 className="font-playfair text-2xl font-light text-foreground">
                Property Rules
              </h2>
              <h2 className="font-playfair text-2xl font-light text-foreground text-right" dir="rtl">
                قواعد العقار
              </h2>
            </div>

            {/* Intro text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                To ensure a pleasant and comfortable stay for all guests, we kindly request your adherence to the following property rules:
              </p>
              <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                لضمان إقامة ممتعة ومريحة لجميع الضيوف، نرجو منكم الالتزام بالقواعد التالية:
              </p>
            </div>

            {/* Rules - aligned rows */}
            <div className="space-y-4">
              {/* Rule 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">1.</span><strong>Pets:</strong> Pets are not permitted on the premises.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">١.</span><strong>الحيوانات الأليفة:</strong> غير مسموح باصطحاب الحيوانات الأليفة داخل المبنى.
                </p>
              </div>

              {/* Rule 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">2.</span><strong>Parties & Events:</strong> Parties and events are strictly prohibited within guest accommodations.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٢.</span><strong>الحفلات والفعاليات:</strong> يُمنع منعاً باتاً إقامة الحفلات والمناسبات داخل أماكن إقامة الضيوف.
                </p>
              </div>

              {/* Rule 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">3.</span><strong>Waste Disposal:</strong> Garbage must be disposed of in designated garbage rooms only. Please contact reception for assistance. Garbage bags may not be left outside room doors.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٣.</span><strong>التخلص من النفايات:</strong> يجب التخلص من القمامة في غرف القمامة المخصصة فقط. يرجى التواصل مع الاستقبال للمساعدة. لا يُسمح بترك أكياس القمامة خارج أبواب الغرف.
                </p>
              </div>

              {/* Rule 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">4.</span><strong>Smoking:</strong> Smoking is prohibited in all indoor areas. Designated outdoor smoking areas are available.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٤.</span><strong>التدخين:</strong> يُمنع التدخين في جميع الأماكن الداخلية. تتوفر مناطق مخصصة للتدخين في الهواء الطلق.
                </p>
              </div>

              {/* Rule 5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">5.</span><strong>Alcohol:</strong> Alcoholic beverages are not permitted in common areas.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٥.</span><strong>المشروبات الكحولية:</strong> لا يُسمح بتناول المشروبات الكحولية في الأماكن العامة.
                </p>
              </div>

              {/* Rule 6 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">6.</span><strong>Prohibited Substances:</strong> Possession or use of illegal substances is strictly prohibited.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٦.</span><strong>المواد المحظورة:</strong> يُمنع منعاً باتاً حيازة أو استخدام المواد غير المشروعة.
                </p>
              </div>

              {/* Rule 7 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">7.</span><strong>Property Damage:</strong> Guests are responsible for any damage caused during their stay. A penalty may be applied based on the nature and extent of the damage.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٧.</span><strong>الأضرار بالممتلكات:</strong> يتحمل الضيوف مسؤولية أي أضرار تحدث خلال إقامتهم. قد يتم تطبيق غرامة بناءً على طبيعة ومدى الضرر.
                </p>
              </div>

              {/* Rule 8 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <span className="mr-2">8.</span><strong>Furniture:</strong> Furniture has been thoughtfully arranged for your comfort and safety. Please refrain from rearranging or relocating any furnishings.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <span className="ml-2">٨.</span><strong>الأثاث:</strong> تم ترتيب الأثاث بعناية لراحتكم وسلامتكم. يرجى عدم إعادة ترتيب أو نقل أي قطع أثاث.
                </p>
              </div>

              {/* Rule 9 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  <p><span className="mr-2">9.</span><strong>Liability Disclaimer:</strong> SuiteSpot ICONIA shall not be held liable for:</p>
                  <ul className="list-disc list-outside ml-8 mt-2 space-y-1">
                    <li>Personal accidents, injuries, or illness occurring on the premises</li>
                    <li>Loss or theft of valuables not secured in the in-room safe provided</li>
                  </ul>
                </div>
                <div className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  <p><span className="ml-2">٩.</span><strong>إخلاء المسؤولية:</strong> لا تتحمل SuiteSpot ICONIA المسؤولية عن:</p>
                  <ul className="list-disc list-outside mr-8 mt-2 space-y-1">
                    <li>الحوادث الشخصية أو الإصابات أو الأمراض التي تحدث داخل المبنى</li>
                    <li>فقدان أو سرقة الأشياء الثمينة التي لم توضع في الخزنة المتوفرة في الغرفة</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Agreement text - spans full width */}
            <div className="font-playfair text-base font-normal leading-relaxed text-foreground space-y-4 mt-8">
              <p className="pt-2">
                By signing below, I acknowledge and agree to abide by the above property rules.{' '}
                <button
                  type="button"
                  onClick={() => setBreachDialogOpen(true)}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  Any violation of these terms shall result in immediate termination of this rental agreement without refund, and guests will be required to vacate the premises forthwith.
                </button>
              </p>
              <p className="text-muted-foreground">
                A minimum penalty of $100 may be assessed, subject to the nature and extent of any damages incurred to the room.
              </p>
              <p className="text-muted-foreground">
                A penalty of $20 will be charged for lost access keys.
              </p>
            </div>
          </section>

          {/* Housekeeping, Property Condition, and Guest Responsibility */}
          <section>
            {/* Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <h2 className="font-playfair text-2xl font-light text-foreground">
                Housekeeping, Property Condition, and Guest Responsibility
              </h2>
              <h2 className="font-playfair text-2xl font-light text-foreground text-right" dir="rtl">
                التدبير المنزلي وحالة العقار ومسؤولية الضيف
              </h2>
            </div>

            {/* Points - aligned rows */}
            <div className="space-y-4">
              {/* Point 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  Two housekeeping visits per week are included in the rental rate.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  تتضمن قيمة الإيجار زيارتين للتنظيف أسبوعياً.
                </p>
              </div>

              {/* Point 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  Throughout the rental period, the Guest(s) are responsible for maintaining the property in a clean and good condition.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  خلال فترة الإيجار، يتحمل الضيف (الضيوف) مسؤولية الحفاظ على العقار نظيفاً وفي حالة جيدة.
                </p>
              </div>

              {/* Point 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  The Guest(s) acknowledge that the property is delivered in good condition upon arrival, except for any defects reported to the property manager no later than the end of the first day following arrival.
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  يُقر الضيف (الضيوف) بأن العقار قد تم تسليمه بحالة جيدة عند الوصول، باستثناء أي عيوب يتم الإبلاغ عنها لمدير العقار في موعد أقصاه نهاية اليوم الأول بعد الوصول.
                </p>
              </div>

              {/* Point 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground">
                  Any defects not reported within this timeframe shall be deemed the responsibility of the Guest(s).
                </p>
                <p className="font-playfair text-base font-normal leading-relaxed text-foreground text-right" dir="rtl">
                  أي عيوب لم يتم الإبلاغ عنها خلال هذه الفترة الزمنية تعتبر مسؤولية الضيف (الضيوف).
                </p>
              </div>
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
              I have read and agree to the property rules and{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTermsOfStayDialogOpen(true);
                }}
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                terms of stay
              </button>
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

        {/* Terms of Stay Dialog */}
        <Dialog open={termsOfStayDialogOpen} onOpenChange={setTermsOfStayDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair text-xl font-semibold">
                Terms of Stay
              </DialogTitle>
            </DialogHeader>
            <DialogDescription className="font-playfair text-base leading-relaxed text-foreground space-y-6">
              <div>
                <p className="mb-4">
                  This Agreement, and all transactions contemplated hereunder, shall be governed by and construed in accordance with the laws of the Arab Republic of Egypt.
                </p>
                <p className="mb-4">
                  Any dispute arising out of or in connection with this Agreement shall first be resolved through amicable conciliation between the parties.
                </p>
                <p>
                  If such dispute cannot be resolved through conciliation, the parties irrevocably agree that the courts of the Arab Republic of Egypt shall have exclusive jurisdiction to settle such dispute.
                </p>
              </div>
              
              <hr className="border-border" />
              
              <div dir="rtl" className="text-right">
                <p className="mb-4">
                  تخضع هذه الاتفاقية وجميع المعاملات المتوقعة بموجبها لقوانين جمهورية مصر العربية وتُفسَّر وفقاً لها.
                </p>
                <p className="mb-4">
                  يتم حل أي نزاع ينشأ عن هذه الاتفاقية أو يتعلق بها أولاً من خلال التوفيق الودي بين الأطراف.
                </p>
                <p>
                  إذا تعذر حل هذا النزاع من خلال التوفيق، يوافق الأطراف بشكل نهائي على أن محاكم جمهورية مصر العربية لها الاختصاص الحصري للفصل في هذا النزاع.
                </p>
              </div>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GuestCheckIn;
