import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

interface Reservation {
  id: string;
  booking_reference: string;
  channel: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  guest_names: string[];
  guest_nationality: string | null;
  guest_ages: number[];
  contact_email: string | null;
  contact_phone: string | null;
  total_price: number;
  currency: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  units: { name: string } | null;
}

const statusColors = {
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const ReservationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'front_desk';

  useEffect(() => {
    fetchReservation();
  }, [id]);

  const fetchReservation = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, units(name)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setReservation(data as Reservation);
      setStatus(data.status);
      setNotes(data.notes || '');
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to edit reservations');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('reservations')
      .update({ status, notes })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update reservation');
    } else {
      toast.success('Reservation updated successfully');
      fetchReservation();
    }
    setSaving(false);
  };

  if (!reservation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Reservation Details</h1>
          <p className="text-muted-foreground">Booking Reference: {reservation.booking_reference}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Guest Names</Label>
              <div className="mt-1 space-y-1">
                {reservation.guest_names.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    {reservation.guest_ages[idx] && (
                      <span className="text-sm text-muted-foreground">({reservation.guest_ages[idx]} years old)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Nationality</Label>
              <p className="mt-1 font-medium">{reservation.guest_nationality || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Number of Guests</Label>
              <p className="mt-1 font-medium">{reservation.number_of_guests}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Contact Email</Label>
              <p className="mt-1 font-medium">{reservation.contact_email || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Contact Phone</Label>
              <p className="mt-1 font-medium">{reservation.contact_phone || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Unit Number</Label>
              <p className="mt-1 text-2xl font-bold">{reservation.units?.name || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Check-in Date</Label>
              <p className="mt-1 font-medium">{format(new Date(reservation.check_in_date), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Check-out Date</Label>
              <p className="mt-1 font-medium">{format(new Date(reservation.check_out_date), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Nights</Label>
              <p className="mt-1 font-medium">{reservation.nights}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Price</Label>
              <p className="mt-1 font-medium">
                {reservation.total_price} {reservation.currency}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Channel</Label>
              <p className="mt-1 font-medium">{reservation.channel}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Status & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Status</Label>
              <div className="mt-2">
                <Badge className={statusColors[reservation.status as keyof typeof statusColors]}>
                  {reservation.status}
                </Badge>
              </div>
            </div>
            {canEdit && (
              <>
                <div>
                  <Label htmlFor="status">Change Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="In-House">In-House</SelectItem>
                      <SelectItem value="Checked-Out">Checked-Out</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this reservation..."
                    className="mt-2"
                    rows={4}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
            {!canEdit && reservation.notes && (
              <div>
                <Label>Notes</Label>
                <p className="mt-2 text-sm text-muted-foreground">{reservation.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReservationDetail;