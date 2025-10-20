import { supabase } from "@/integrations/supabase/client";

/**
 * One-time utility to update the logo in storage
 * Run this once, then delete this file
 */
export async function updateLogoInStorage() {
  try {
    // Fetch the logo from assets
    const response = await fetch('/src/assets/suitespot-logo.png');
    const blob = await response.blob();
    
    // Upload to storage with upsert to replace existing
    const { data, error } = await supabase.storage
      .from('assets')
      .upload('suitespot-logo.png', blob, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '0' // Disable cache to force refresh
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error };
    }

    console.log('Logo updated successfully!', data);
    
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
