import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Plus, Trash2 } from 'lucide-react';

interface PropertyAccess {
  id: string;
  property_id: string;
  role: string;
  property_name: string;
}

interface Property {
  id: string;
  name: string;
}

const ROLES = ['owner', 'admin', 'manager', 'staff', 'viewer'] as const;

interface PropertyAccessSectionProps {
  userId: string;
  isAdmin: boolean;
}

export function PropertyAccessSection({ userId, isAdmin }: PropertyAccessSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accessList, setAccessList] = useState<PropertyAccess[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [addPropertyId, setAddPropertyId] = useState('');
  const [addRole, setAddRole] = useState('staff');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accessRes, propsRes] = await Promise.all([
        supabase
          .from('user_property_access')
          .select('id, property_id, role')
          .eq('user_id', userId),
        supabase
          .from('properties')
          .select('id, name')
          .eq('is_active', true),
      ]);

      if (accessRes.error) throw accessRes.error;
      if (propsRes.error) throw propsRes.error;

      const properties = propsRes.data || [];
      const propMap = new Map(properties.map(p => [p.id, p.name]));

      setAccessList(
        (accessRes.data || []).map(a => ({
          ...a,
          property_name: propMap.get(a.property_id) || 'Unknown Property',
        }))
      );
      setAllProperties(properties);
    } catch (error) {
      console.error('Error fetching property access:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (accessId: string, newRole: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_property_access')
        .update({ role: newRole })
        .eq('id', accessId);
      if (error) throw error;
      setAccessList(prev =>
        prev.map(a => (a.id === accessId ? { ...a, role: newRole } : a))
      );
      toast({ title: 'Role updated' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (accessId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_property_access')
        .delete()
        .eq('id', accessId);
      if (error) throw error;
      setAccessList(prev => prev.filter(a => a.id !== accessId));
      toast({ title: 'Access removed' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to remove access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!addPropertyId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_property_access')
        .insert({
          user_id: userId,
          property_id: addPropertyId,
          role: addRole,
        })
        .select('id, property_id, role')
        .single();
      if (error) throw error;

      const propName = allProperties.find(p => p.id === addPropertyId)?.name || 'Unknown';
      setAccessList(prev => [...prev, { ...data, property_name: propName }]);
      setAddPropertyId('');
      setAddRole('staff');
      toast({ title: 'Property access granted' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const assignedPropertyIds = new Set(accessList.map(a => a.property_id));
  const availableProperties = allProperties.filter(p => !assignedPropertyIds.has(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Label className="font-semibold text-sm">Property Access</Label>
      </div>

      {accessList.length === 0 ? (
        <p className="text-xs text-muted-foreground">No property access assigned.</p>
      ) : (
        <div className="space-y-2">
          {accessList.map(access => (
            <div
              key={access.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-sm truncate flex-1">{access.property_name}</span>
              <Select
                value={access.role}
                onValueChange={val => handleRoleChange(access.id, val)}
                disabled={saving}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleRemove(access.id)}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableProperties.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Select value={addPropertyId} onValueChange={setAddPropertyId}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Add property..." />
            </SelectTrigger>
            <SelectContent>
              {availableProperties.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={addRole} onValueChange={setAddRole}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r} value={r} className="capitalize text-xs">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={handleAdd}
            disabled={!addPropertyId || saving}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
