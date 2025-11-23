import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Key, Ban, CheckCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import bcrypt from "bcryptjs";

interface GuestAccount {
  id: string;
  username: string;
  is_active: boolean;
  first_login_at: string | null;
  last_login_at: string | null;
  created_at: string;
  reservation_id: string;
  reservations: {
    guest_names: string[];
    check_in_date: string;
    check_out_date: string;
    booking_reference: string;
    channel: string;
  };
}

export default function GuestAccounts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<GuestAccount[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GuestAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAndFetch();
    }
  }, [user]);

  const checkAdminAndFetch = async () => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();

    if (roleData?.role !== "admin") {
      navigate("/admin");
      return;
    }

    fetchAccounts();
  };

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("guest_accounts")
      .select(`
        *,
        reservations (
          guest_names,
          check_in_date,
          check_out_date,
          booking_reference,
          channel
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load guest accounts");
      console.error(error);
    } else {
      setAccounts(data as GuestAccount[]);
    }
    setLoading(false);
  };

  const toggleActiveStatus = async (accountId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("guest_accounts")
      .update({ is_active: !currentStatus })
      .eq("id", accountId);

    if (error) {
      toast.error("Failed to update account status");
    } else {
      toast.success(`Account ${!currentStatus ? "activated" : "deactivated"}`);
      fetchAccounts();
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setResetting(true);
    try {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      const { error } = await supabase.rpc("reset_guest_password", {
        p_account_id: selectedAccount?.id,
        p_new_password_hash: passwordHash,
      });

      if (error) throw error;

      toast.success("Password reset successfully");
      setResetDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setSelectedAccount(null);
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const copyUsername = (username: string) => {
    navigator.clipboard.writeText(username);
    toast.success("Username copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Guest Accounts Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Guest Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Booking Source</TableHead>
                  <TableHead>Check-in / Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Login</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No guest accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.username}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyUsername(account.username)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {account.reservations.booking_reference}
                      </TableCell>
                      <TableCell>{account.reservations.guest_names[0]}</TableCell>
                      <TableCell>{account.reservations.channel}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(account.reservations.check_in_date), "MMM d, yyyy")}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(account.reservations.check_out_date), "MMM d, yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.first_login_at
                          ? format(new Date(account.first_login_at), "MMM d, yyyy HH:mm")
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {account.last_login_at
                          ? format(new Date(account.last_login_at), "MMM d, yyyy HH:mm")
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAccount(account);
                              setResetDialogOpen(true);
                            }}
                          >
                            <Key className="h-4 w-4 mr-1" />
                            Reset Password
                          </Button>
                          <Button
                            variant={account.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleActiveStatus(account.id, account.is_active)}
                          >
                            {account.is_active ? (
                              <>
                                <Ban className="h-4 w-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for guest account: <strong>{selectedAccount?.username}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetDialogOpen(false);
                setNewPassword("");
                setConfirmPassword("");
                setSelectedAccount(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
