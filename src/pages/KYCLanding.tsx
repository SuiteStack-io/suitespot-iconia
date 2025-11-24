import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import guestLoginBg from "@/assets/guest-login-bg.webp";
import { supabase } from "@/integrations/supabase/client";

export default function KYCLanding() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Replace this with your actual Typeform URL
  const typeformUrl = "https://form.typeform.com/to/HB53DCc4";

  useEffect(() => {
    // Check if this KYC link was already completed
    const checkStatus = async () => {
      if (!token) return;

      const { data } = await supabase.from("kyc_links").select("status").eq("token", token).single();

      if (data?.status === "completed") {
        setSubmitted(true);
      }
    };

    checkStatus();

    // Listen for message from Typeform when submitted
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === "form-submit") {
        setShowForm(false);
        setSubmitted(true);

        // Update KYC link status in database
        if (token) {
          await supabase
            .from("kyc_links")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("token", token);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [token]);

  const showTypeform = () => {
    setShowForm(true);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${guestLoginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {!showForm && !submitted && (
        <Card className="w-full max-w-2xl backdrop-blur-md bg-white/40 shadow-2xl border border-white/20">
          <CardContent className="p-12">
            <div className="text-center space-y-8">
              <div className="space-y-4">
                <h1
                  className="font-playfair text-almaza-gold text-6xl font-semibold tracking-tight"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Welcome to SuiteSpot Almaza
                </h1>
                <p className="font-playfair text-2xl font-medium text-gray-800 leading-relaxed">
                  We're excited to guide you through the next step
                </p>
              </div>

              <Button onClick={showTypeform} size="lg" className="font-playfair text-xl font-medium px-12 py-6 h-auto">
                Go to Questionnaire
              </Button>

              <p className="font-playfair text-lg text-gray-800 mt-8">
                This will help us tailor the perfect home options for your stay
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && !submitted && (
        <div className="w-full h-screen fixed inset-0 z-50 animate-in fade-in duration-300">
          <iframe src={typeformUrl} className="w-full h-full border-0" title="KYC Questionnaire" />
        </div>
      )}

      {submitted && (
        <Card className="w-full max-w-2xl backdrop-blur-md bg-white/40 shadow-2xl border border-white/20">
          <CardContent className="p-12">
            <div className="text-center space-y-6">
              <h1
                className="font-playfair text-almaza-gold text-6xl font-semibold tracking-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                Thank You!
              </h1>
              <p className="font-playfair text-2xl font-medium text-gray-800 leading-relaxed">
                We will get back to you within 3 hours with options tailored to your needs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
