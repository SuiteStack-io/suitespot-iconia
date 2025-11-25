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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Key, Ban, CheckCircle, Copy, UserPlus, Loader2 } from "lucide-react";
import { format } from "date-fns";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

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
  
  // Create account states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ username: string; password: string } | null>(null);

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
    fetchReservations();
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, booking_reference, guest_names, check_in_date, check_out_date, units(name)")
      .eq("status", "confirmed")
      .order("check_in_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching reservations:", error);
    } else {
      setReservations(data || []);
    }
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
      toast.error("Failed to load app accounts");
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
      const passwordHash = await hashPassword(newPassword);
      
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

  const handleCreateAccount = async () => {
    if (!selectedReservationId || !firstName.trim() || !lastName.trim()) {
      toast.error("Please select a reservation and enter first and last name");
      return;
    }

    // Check how many accounts already exist for this reservation
    const { count } = await supabase
      .from("guest_accounts")
      .select("*", { count: "exact", head: true })
      .eq("reservation_id", selectedReservationId);

    if (count && count >= 4) {
      toast.error("Maximum 4 app accounts per reservation");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-guest-account", {
        body: {
          reservationId: selectedReservationId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      });

      if (error) throw error;

      setGeneratedCredentials({
        username: data.username,
        password: data.password,
      });

      toast.success("App account created successfully");
      fetchAccounts();
    } catch (error: any) {
      console.error("Error creating app account:", error);
      toast.error(error.message || "Failed to create app account");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setTimeout(() => {
      setSelectedReservationId("");
      setFirstName("");
      setLastName("");
      setGeneratedCredentials(null);
    }, 300);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">App Accounts Management</h1>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create App Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All App Accounts ({accounts.length})</CardTitle>
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
                      No app accounts found
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
              Reset password for app account: <strong>{selectedAccount?.username}</strong>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create App Account</DialogTitle>
            <DialogDescription>
              Generate login credentials for a guest
            </DialogDescription>
          </DialogHeader>

          {!generatedCredentials ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reservation">Select Reservation</Label>
                <Select value={selectedReservationId} onValueChange={setSelectedReservationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a reservation" />
                  </SelectTrigger>
                  <SelectContent>
                    {reservations.map((reservation) => (
                      <SelectItem key={reservation.id} value={reservation.id}>
                        {reservation.booking_reference} - {reservation.guest_names[0]} ({format(new Date(reservation.check_in_date), "MMM d")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                This will create a guest portal account with automatically generated credentials.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex gap-2">
                  <Input value={generatedCredentials.username} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generatedCredentials.username, "Username")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input value={generatedCredentials.password} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generatedCredentials.password, "Password")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    const whatsappMessage = `Welcome to SuiteSpot Almaza! We're excited to have you with us. Below are your login details to access your guest portal and manage everything related to your stay.

Username: 
${generatedCredentials.username}

Password: 
${generatedCredentials.password}

Once logged in, you'll be able to view check-in details, access your stay information, and enjoy a seamless SuiteSpot experience. If you need anything at all, we're just a message away.

Wishing you an amazing summer stay! 🌴🌊`;
                    navigator.clipboard.writeText(whatsappMessage);
                    toast.success("WhatsApp message copied to clipboard!");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy WhatsApp Message
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Next Steps:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Copy the WhatsApp message above</li>
                  <li>Send it to the guest via WhatsApp</li>
                  <li>Guest can log in at: {window.location.origin}/guest/login</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter>
            {!generatedCredentials ? (
              <>
                <Button variant="outline" onClick={handleCloseCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAccount} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Generate Credentials"
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseCreateDialog}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
