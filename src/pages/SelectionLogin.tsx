import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelectionAuth } from "@/lib/selectionAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import guestLoginBg from '@/assets/guest-login-bg.webp';

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
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${guestLoginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="w-full max-w-md">
        <div className="backdrop-blur-md bg-white/40 dark:bg-white/40 shadow-2xl border border-white/20 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-playfair text-almaza-gold text-6xl font-semibold tracking-tight mb-2" style={{ letterSpacing: "-0.02em" }}>
              Almaza Selection
            </h1>
            <p className="font-playfair text-xl font-medium text-gray-800 dark:text-gray-800">
              Enter your credentials to view your curated properties
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-playfair text-base font-medium text-gray-800">Username</Label>
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
              <Label htmlFor="password" className="font-playfair text-base font-medium text-gray-800">Password</Label>
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
              className="w-full font-playfair text-base font-medium"
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

          <p className="font-playfair text-base text-gray-900 text-center mt-6">
            Your session will expire 15 minutes after first access
          </p>
        </div>
      </div>
    </div>
  );
}
