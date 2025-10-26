import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Plus, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  unit_size: string | null;
  status: string;
  booking_com_id: string | null;
  comments: string | null;
}

const Rooms = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedUnit, setEditedUnit] = useState<Partial<Unit>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({
    name: '',
    unit_number: '',
    unit_type: '',
    unit_size: '',
    status: 'available',
    booking_com_id: '',
    comments: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUnits();
    }
  }, [user]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch rooms',
      });
      return;
    }

    setUnits(data || []);
  };

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditedUnit(unit);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedUnit({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('units')
      .update(editedUnit)
      .eq('id', editingId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update room',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Room updated successfully',
    });

    setEditingId(null);
    setEditedUnit({});
    fetchUnits();
  };

  const handleAddRoom = async () => {
    if (!newUnit.name) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Room name is required',
      });
      return;
    }

    const { error } = await supabase.from('units').insert([{
      name: newUnit.name,
      unit_number: newUnit.unit_number || null,
      unit_type: newUnit.unit_type || null,
      unit_size: newUnit.unit_size || null,
      status: newUnit.status || 'available',
      booking_com_id: newUnit.booking_com_id || null,
      comments: newUnit.comments || null,
    }]);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add room',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Room added successfully',
    });

    setIsAdding(false);
    setNewUnit({
      name: '',
      unit_number: '',
      unit_type: '',
      unit_size: '',
      status: 'available',
      booking_com_id: '',
      comments: '',
    });
    fetchUnits();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Rooms Management</h1>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room Name</TableHead>
                <TableHead>Unit Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booking.com ID</TableHead>
                <TableHead>Comments</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <TableRow className="bg-muted/50">
                  <TableCell>
                    <Input
                      value={newUnit.name}
                      onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                      placeholder="Room name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_number || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })}
                      placeholder="Unit #"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_type || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_type: e.target.value })}
                      placeholder="Type"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_size || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_size: e.target.value })}
                      placeholder="Size"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.status}
                      onChange={(e) => setNewUnit({ ...newUnit, status: e.target.value })}
                      placeholder="Status"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.booking_com_id || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, booking_com_id: e.target.value })}
                      placeholder="Booking.com ID"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.comments || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, comments: e.target.value })}
                      placeholder="Comments"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddRoom}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAdding(false);
                          setNewUnit({
                            name: '',
                            unit_number: '',
                            unit_type: '',
                            unit_size: '',
                            status: 'available',
                            booking_com_id: '',
                            comments: '',
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.name}
                        onChange={(e) => setEditedUnit({ ...editedUnit, name: e.target.value })}
                      />
                    ) : (
                      unit.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.unit_number || ''}
                        onChange={(e) => setEditedUnit({ ...editedUnit, unit_number: e.target.value })}
                      />
                    ) : (
                      unit.unit_number || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.unit_type || ''}
                        onChange={(e) => setEditedUnit({ ...editedUnit, unit_type: e.target.value })}
                      />
                    ) : (
                      unit.unit_type || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.unit_size || ''}
                        onChange={(e) => setEditedUnit({ ...editedUnit, unit_size: e.target.value })}
                      />
                    ) : (
                      unit.unit_size || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.status}
                        onChange={(e) => setEditedUnit({ ...editedUnit, status: e.target.value })}
                      />
                    ) : (
                      <span className="capitalize">{unit.status}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.booking_com_id || ''}
                        onChange={(e) => setEditedUnit({ ...editedUnit, booking_com_id: e.target.value })}
                        placeholder="Enter Booking.com ID"
                      />
                    ) : (
                      <span className="font-mono text-sm">{unit.booking_com_id || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === unit.id ? (
                      <Input
                        value={editedUnit.comments || ''}
                        onChange={(e) => setEditedUnit({ ...editedUnit, comments: e.target.value })}
                      />
                    ) : (
                      unit.comments || '-'
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {editingId === unit.id ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default Rooms;
