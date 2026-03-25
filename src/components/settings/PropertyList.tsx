import { useState, useEffect } from 'react';
import { useProperty, Property } from '@/lib/propertyContext';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Users, Trash2, Star, Building2, CheckCircle2, XCircle, DoorOpen, Power } from 'lucide-react';
import { PropertyForm } from './PropertyForm';
import { ManagePropertyUsersDialog } from './ManagePropertyUsersDialog';
import { DeletePropertyDialog } from './DeletePropertyDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

export function PropertyList() {
  const { properties, isLoading, refreshProperties, isSystemAdmin, canManageUsers, canDeleteProperty } = useProperty();
  const { userRole } = useAuth();
  const canCreate = isSystemAdmin || userRole === 'admin';
  const canEdit = isSystemAdmin || userRole === 'admin';
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [managingUsersFor, setManagingUsersFor] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (properties.length === 0) return;
    // Fetch room counts
    supabase
      .from('units')
      .select('property_id')
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach(u => { if (u.property_id) counts[u.property_id] = (counts[u.property_id] || 0) + 1; });
        setRoomCounts(counts);
      });
    // Fetch reservation counts per property (to determine if delete is safe)
    supabase
      .from('reservations')
      .select('property_id')
      .not('status', 'in', '("cancelled","completed","checked-out")')
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach(r => { if (r.property_id) counts[r.property_id] = (counts[r.property_id] || 0) + 1; });
        setReservationCounts(counts);
      });
  }, [properties]);

  const handleSetDefault = async (property: Property) => {
    const { error } = await supabase
      .from('properties')
      .update({ is_default: true })
      .eq('id', property.id);
    if (error) {
      toast.error('Failed to set default property');
    } else {
      toast.success(`${property.name} set as default`);
      refreshProperties();
    }
  };

  const handleToggleActive = async (property: Property) => {
    const newStatus = !property.is_active;
    if (!newStatus && property.is_default) {
      toast.error('Cannot deactivate the default property. Set another as default first.');
      return;
    }
    const { error } = await supabase
      .from('properties')
      .update({ is_active: newStatus })
      .eq('id', property.id);
    if (error) {
      toast.error('Failed to update property status');
    } else {
      toast.success(`${property.name} ${newStatus ? 'activated' : 'deactivated'}`);
      refreshProperties();
    }
  };

  const handleDeleteAttempt = (property: Property) => {
    const hasReservations = (reservationCounts[property.id] || 0) > 0;
    if (hasReservations) {
      toast.error('This property has existing bookings and cannot be deleted. Deactivate it instead.');
      return;
    }
    setDeletingProperty(property);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Properties</h2>
        {canCreate && (
          <Button onClick={() => setShowCreateForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add Property
          </Button>
        )}
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No properties configured yet.</p>
            {canCreate && (
              <Button onClick={() => setShowCreateForm(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Create First Property
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {properties.map(property => (
            <Card key={property.id} className={!property.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {property.is_default && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold truncate">{property.name}</h3>
                      <Badge variant={property.is_active ? 'default' : 'secondary'} className="text-xs">
                        {property.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {property.city}, {property.country} | {property.currency} | {property.timezone}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <DoorOpen className="h-3 w-3" /> {roomCounts[property.id] || 0} rooms
                      </span>
                      {property.channex_synced ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Channex Synced
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Not Synced
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex items-center gap-2 mr-2" title={property.is_active ? 'Deactivate' : 'Activate'}>
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch
                          checked={property.is_active ?? true}
                          onCheckedChange={() => handleToggleActive(property)}
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setEditingProperty(property)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canManageUsers && (
                        <Button variant="ghost" size="sm" onClick={() => setManagingUsersFor(property)}>
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      {!property.is_default && (
                        <Button variant="ghost" size="sm" onClick={() => handleSetDefault(property)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && !property.is_default && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteAttempt(property)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(showCreateForm || editingProperty) && (
        <PropertyForm
          property={editingProperty}
          open={showCreateForm || !!editingProperty}
          onClose={() => {
            setShowCreateForm(false);
            setEditingProperty(null);
          }}
          onSaved={() => {
            setShowCreateForm(false);
            setEditingProperty(null);
            refreshProperties();
          }}
        />
      )}

      {managingUsersFor && (
        <ManagePropertyUsersDialog
          property={managingUsersFor}
          open={!!managingUsersFor}
          onClose={() => setManagingUsersFor(null)}
        />
      )}

      {deletingProperty && (
        <DeletePropertyDialog
          property={deletingProperty}
          open={!!deletingProperty}
          onClose={() => setDeletingProperty(null)}
          onDeleted={() => {
            setDeletingProperty(null);
            refreshProperties();
          }}
        />
      )}
    </div>
  );
}
