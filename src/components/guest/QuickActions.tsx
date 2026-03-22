import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, MessageSquare, MapPin, Wifi, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface QuickActionsProps {
  unitId: string;
}

export function QuickActions({ unitId }: QuickActionsProps) {
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);

  const phoneNumber = "+201234567890";
  const wifiNetwork = "SuiteSpot_Guest";
  const wifiPassword = "Welcome2024";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const actions = [
    {
      icon: Phone,
      label: "Call Front Desk",
      action: () => setCallDialogOpen(true),
      variant: "default" as const,
    },
    {
      icon: MessageSquare,
      label: "WhatsApp Support",
      action: () => setWhatsappDialogOpen(true),
      variant: "outline" as const,
    },
    {
      icon: MapPin,
      label: "View Map",
      action: () => setMapDialogOpen(true),
      variant: "outline" as const,
    },
    {
      icon: Wifi,
      label: "WiFi Info",
      action: () => setWifiDialogOpen(true),
      variant: "outline" as const,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                onClick={action.action}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <action.icon className="h-6 w-6" />
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Call Front Desk Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Call Front Desk</DialogTitle>
            <DialogDescription className="text-center">
              Our team is available 24/7 to assist you with anything you need during your stay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground mb-2">{phoneNumber}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(phoneNumber, "Phone number")}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Number
              </Button>
            </div>
            <Button
              onClick={() => {
                window.open(`tel:${phoneNumber}`);
                setCallDialogOpen(false);
              }}
              className="w-full gap-2"
              size="lg"
            >
              <Phone className="h-4 w-4" />
              Call Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Support Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center">WhatsApp Support</DialogTitle>
            <DialogDescription className="text-center">
              Chat with us on WhatsApp for quick responses to your questions and requests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium mb-2 text-foreground">We can help with:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Room service requests</li>
                <li>• Property information</li>
                <li>• Check-in/out assistance</li>
                <li>• Local recommendations</li>
              </ul>
            </div>
            <Button
              onClick={() => {
                window.open(`https://wa.me/${phoneNumber.replace('+', '')}`);
                setWhatsappDialogOpen(false);
              }}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <MessageSquare className="h-4 w-4" />
              Open WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-center">Property Location</DialogTitle>
            <DialogDescription className="text-center">
              Find nearby places and get directions to our property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium mb-2 text-foreground">Address</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Contact the front desk for our property address.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard("SuiteSpot", "Property name")}
                className="gap-2 w-full"
              >
                <Copy className="h-4 w-4" />
                Copy Address
              </Button>
            </div>
            <Button
              onClick={() => {
                window.open("https://maps.google.com/?q=SuiteSpot");
                setMapDialogOpen(false);
              }}
              className="w-full gap-2"
              size="lg"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Google Maps
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WiFi Info Dialog */}
      <Dialog open={wifiDialogOpen} onOpenChange={setWifiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
              <Wifi className="h-6 w-6 text-purple-600" />
            </div>
            <DialogTitle className="text-center">WiFi Information</DialogTitle>
            <DialogDescription className="text-center">
              Connect to our high-speed internet during your stay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Network Name</label>
                <div className="flex items-center justify-between mt-1 p-3 bg-background rounded-md">
                  <span className="font-mono font-semibold text-foreground">{wifiNetwork}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(wifiNetwork, "Network name")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Password</label>
                <div className="flex items-center justify-between mt-1 p-3 bg-background rounded-md">
                  <span className="font-mono font-semibold text-foreground">{wifiPassword}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(wifiPassword, "Password")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              Tap the copy icons to easily paste the credentials
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
