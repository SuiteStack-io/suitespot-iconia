import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface SelectionCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  credentials: {
    link: string;
    username: string;
    password: string;
  } | null;
}

export const SelectionCredentialsModal = ({
  open,
  onClose,
  credentials
}: SelectionCredentialsModalProps) => {
  if (!credentials) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyWhatsAppMessage = () => {
    const message = `Here is the selection we have catered to your needs. Please let us know which options you like.

Link: ${credentials.link}
Username: ${credentials.username}
Password: ${credentials.password}

Important: your session will automatically expire 15 minutes after opening the link.`;

    navigator.clipboard.writeText(message);
    toast.success("Message copied! Ready to paste in WhatsApp");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Selection Credentials Generated</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Private Landing Page Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={credentials.link}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted/50 text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(credentials.link, "Link")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={credentials.username}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted/50 text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(credentials.username, "Username")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Password</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={credentials.password}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted/50 text-sm font-mono"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(credentials.password, "Password")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              className="w-full"
              size="lg"
              onClick={copyWhatsAppMessage}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Copy to WhatsApp
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Complete message with link, username, and password
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
