import { useState } from 'react';
import { useProperty, Property } from '@/lib/propertyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Users, Trash2, Star, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { PropertyForm } from './PropertyForm';
import { ManagePropertyUsersDialog } from './ManagePropertyUsersDialog';
import { DeletePropertyDialog } from './DeletePropertyDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PropertyList() {
  const { properties, isLoading, refreshProperties, isSystemAdmin, canManageUsers } = useProperty();
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [managingUsersFor, setManagingUsersFor] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);

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

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Properties</h2>
        {isSystemAdmin && (
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
            {isSystemAdmin && (
              <Button onClick={() => setShowCreateForm(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Create First Property
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {properties.map(property => (
            <Card key={property.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
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
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                    {isSystemAdmin && !property.is_default && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingProperty(property)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
