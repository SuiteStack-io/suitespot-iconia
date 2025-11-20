import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, UserCheck, CheckCircle, XCircle } from "lucide-react";

interface TicketDetailDialogProps {
  ticket: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TicketDetailDialog({ ticket, open, onOpenChange, onUpdate }: TicketDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || "");
  const [status, setStatus] = useState(ticket.status);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");

    if (data) {
      setUsers(data);
    }
  };

  const handleAssign = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("guest_tickets")
        .update({ assigned_to: assignedTo || null })
        .eq("id", ticket.id);

      if (error) throw error;

      toast.success("Ticket assigned successfully");
      onUpdate();
    } catch (error: any) {
      console.error("Error assigning ticket:", error);
      toast.error(error.message || "Failed to assign ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    setLoading(true);
    try {
      const updates: any = { status };

      if (status === "resolved" || status === "closed") {
        const { data: { user } } = await supabase.auth.getUser();
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user?.id;
      }

      const { error } = await supabase
        .from("guest_tickets")
        .update(updates)
        .eq("id", ticket.id);

      if (error) throw error;

      toast.success("Ticket status updated");
      onUpdate();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast.error("Please add resolution notes");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("guest_tickets")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", ticket.id);

      if (error) throw error;

      toast.success("Ticket resolved successfully");
      onUpdate();
    } catch (error: any) {
      console.error("Error resolving ticket:", error);
      toast.error(error.message || "Failed to resolve ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{ticket.title}</span>
            <div className="flex gap-2">
              <Badge variant="outline">{ticket.priority}</Badge>
              <Badge>{ticket.status.replace("_", " ")}</Badge>
            </div>
          </DialogTitle>
          <DialogDescription>
            Ticket #{ticket.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ticket Details */}
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-foreground mt-1">{ticket.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p className="text-foreground">
                  {ticket.ticket_type.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Guest</Label>
                <p className="text-foreground">{ticket.guest_accounts?.username}</p>
              </div>

              {ticket.reservations?.units && (
                <div>
                  <Label className="text-muted-foreground">Unit</Label>
                  <p className="text-foreground">
                    {ticket.reservations.units.name} - {ticket.reservations.units.unit_number}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="text-foreground">
                  {format(new Date(ticket.created_at), "PPpp")}
                </p>
              </div>
            </div>

            {ticket.photo_url && (
              <div>
                <Label className="text-muted-foreground">Photo</Label>
                <img
                  src={ticket.photo_url}
                  alt="Ticket attachment"
                  className="mt-2 rounded-lg border max-h-64 object-cover"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Assignment */}
          <div className="space-y-3">
            <Label>Assign To</Label>
            <div className="flex gap-2">
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || "Unknown User"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </Button>
            </div>
            {ticket.assigned_to_profile && (
              <p className="text-sm text-muted-foreground">
                Currently assigned to: {ticket.assigned_to_profile.full_name}
              </p>
            )}
          </div>

          <Separator />

          {/* Status Update */}
          <div className="space-y-3">
            <Label>Update Status</Label>
            <div className="flex gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleStatusChange} disabled={loading || status === ticket.status}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Resolution */}
          {ticket.status !== "resolved" && ticket.status !== "closed" && (
            <div className="space-y-3">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="Add notes about how this ticket was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
              <Button onClick={handleResolve} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Resolved
                  </>
                )}
              </Button>
            </div>
          )}

          {ticket.resolved_at && (
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Resolved</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Resolved on {format(new Date(ticket.resolved_at), "PPpp")}
                </p>
                {ticket.resolved_by_profile && (
                  <p>By {ticket.resolved_by_profile.full_name}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
