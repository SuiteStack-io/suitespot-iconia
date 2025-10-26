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
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkEditUnits, setBulkEditUnits] = useState<Record<string, Partial<Unit>>>({});
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

    // Real-time updates for units
    const channel = supabase
      .channel('units-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchUnits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleBulkEdit = () => {
    setIsBulkEdit(true);
    const initialBulkEdit: Record<string, Partial<Unit>> = {};
    units.forEach((unit) => {
      initialBulkEdit[unit.id] = { ...unit };
    });
    setBulkEditUnits(initialBulkEdit);
  };

  const handleCancelBulkEdit = () => {
    setIsBulkEdit(false);
    setBulkEditUnits({});
  };

  const handleSaveBulkEdit = async () => {
    const updates = Object.values(bulkEditUnits).map((unit) => 
      supabase
        .from('units')
        .update(unit)
        .eq('id', unit.id!)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((result) => result.error);

    if (hasError) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update some rooms',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'All rooms updated successfully',
    });

    setIsBulkEdit(false);
    setBulkEditUnits({});
    fetchUnits();
  };

  const handleBulkEditChange = (unitId: string, field: keyof Unit, value: any) => {
    setBulkEditUnits((prev) => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [field]: value,
      },
    }));
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
              <div className="flex gap-2">
                {isBulkEdit ? (
                  <>
                    <Button onClick={handleSaveBulkEdit} variant="default">
                      <Save className="h-4 w-4 mr-2" />
                      Save All
                    </Button>
                    <Button onClick={handleCancelBulkEdit} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleBulkEdit} variant="outline">
                      <Pencil className="h-4 w-4 mr-2" />
                      Bulk Edit
                    </Button>
                    <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Room
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room ID</TableHead>
                <TableHead>Unit Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booking.com ID</TableHead>
                <TableHead>Comments</TableHead>
                {isAdmin && !isBulkEdit && <TableHead>Actions</TableHead>}
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
              {units.map((unit) => {
                const isEditing = isBulkEdit || editingId === unit.id;
                const currentUnit = isBulkEdit ? bulkEditUnits[unit.id] : editedUnit;
                
                return (
                  <TableRow key={unit.id}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? bulkEditUnits[unit.id]?.name : editedUnit.name}
                          onChange={(e) => 
                            isBulkEdit 
                              ? handleBulkEditChange(unit.id, 'name', e.target.value)
                              : setEditedUnit({ ...editedUnit, name: e.target.value })
                          }
                        />
                      ) : (
                        unit.name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_number || '') : (editedUnit.unit_number || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_number', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_number: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_number || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_type || '') : (editedUnit.unit_type || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_type', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_type: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_type || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_size || '') : (editedUnit.unit_size || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_size', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_size: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_size || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? bulkEditUnits[unit.id]?.status : editedUnit.status}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'status', e.target.value)
                              : setEditedUnit({ ...editedUnit, status: e.target.value })
                          }
                        />
                      ) : (
                        <span className="capitalize">{unit.status}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.booking_com_id || '') : (editedUnit.booking_com_id || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'booking_com_id', e.target.value)
                              : setEditedUnit({ ...editedUnit, booking_com_id: e.target.value })
                          }
                          placeholder="Enter Booking.com ID"
                        />
                      ) : (
                        <span className="font-mono text-sm">{unit.booking_com_id || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.comments || '') : (editedUnit.comments || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'comments', e.target.value)
                              : setEditedUnit({ ...editedUnit, comments: e.target.value })
                          }
                        />
                      ) : (
                        unit.comments || '-'
                      )}
                    </TableCell>
                    {isAdmin && !isBulkEdit && (
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default Rooms;
