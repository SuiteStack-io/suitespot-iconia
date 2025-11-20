import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, MapPin, Wifi } from "lucide-react";

interface QuickActionsProps {
  unitId: string;
}

export function QuickActions({ unitId }: QuickActionsProps) {
  const actions = [
    {
      icon: Phone,
      label: "Call Front Desk",
      action: () => window.open("tel:+201234567890"),
      variant: "default" as const,
    },
    {
      icon: MessageSquare,
      label: "WhatsApp Support",
      action: () => window.open("https://wa.me/201234567890"),
      variant: "outline" as const,
    },
    {
      icon: MapPin,
      label: "View Map",
      action: () => {
        // This will be implemented in Phase 5
        alert("Map feature coming soon!");
      },
      variant: "outline" as const,
    },
    {
      icon: Wifi,
      label: "WiFi Info",
      action: () => {
        alert("WiFi Network: SuiteSpot_Guest\nPassword: Welcome2024");
      },
      variant: "outline" as const,
    },
  ];

  return (
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
  );
}
