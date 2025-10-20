import { supabase } from "@/integrations/supabase/client";

/**
 * One-time utility to upload the SuiteSpot logo to storage
 * Run this once from the browser console or a temporary component
 */
export async function uploadLogoToStorage() {
  try {
    // Fetch the logo from src/assets
    const response = await fetch('/src/assets/suitespot-logo.png');
    const blob = await response.blob();
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('assets')
      .upload('suitespot-logo.png', blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error };
    }

    console.log('Logo uploaded successfully!', data);
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('assets')
      .getPublicUrl('suitespot-logo.png');
    
    console.log('Public URL:', urlData.publicUrl);
    return { success: true, url: urlData.publicUrl };
  } catch (err) {
    console.error('Error:', err);
    return { success: false, error: err };
  }
}
