import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelectionAuth } from "@/lib/selectionAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SelectionLogin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useSelectionAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error("Invalid access link");
      return;
    }

    setLoading(true);

    const { error } = await login(username, password, token);

    if (error) {
      toast.error(error);
      setLoading(false);
      return;
    }

    navigate(`/selection/${token}`);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4"
      style={{
        backgroundImage: "url('/lovable-uploads/26e5c95e-58d2-4c28-82de-1ee3dcc6e70f.png')"
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-background/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-border/50">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-2" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "-0.02em" }}>
              Almaza Selection
            </h1>
            <p className="text-lg text-muted-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Enter your credentials to view your curated properties
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="firstname_lastname"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accessing...
                </>
              ) : (
                "Access Selection"
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Your session will expire 15 minutes after first access
          </p>
        </div>
      </div>
    </div>
  );
}
