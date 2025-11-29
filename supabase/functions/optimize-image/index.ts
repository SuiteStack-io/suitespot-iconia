import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const imageFile = formData.get('file') as File;
    const bucketName = formData.get('bucket') as string;
    const originalPath = formData.get('path') as string;

    if (!imageFile || !bucketName || !originalPath) {
      throw new Error('Missing required fields: file, bucket, or path');
    }

    console.log(`Optimizing image: ${originalPath} in bucket: ${bucketName}`);

    // Read the image file
    const imageBuffer = await imageFile.arrayBuffer();
    const image = await Image.decode(new Uint8Array(imageBuffer));

    const originalWidth = image.width;
    const originalHeight = image.height;
    const aspectRatio = originalHeight / originalWidth;

    console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);

    const sizes = [
      { name: 'sm', width: 640 },
      { name: 'md', width: 1280 },
      { name: 'lg', width: 1920 },
      { name: 'blur', width: 20 }
    ];

    const optimizedUrls: Record<string, string> = {};

    for (const size of sizes) {
      const targetWidth = Math.min(size.width, originalWidth);
      const targetHeight = Math.round(targetWidth * aspectRatio);

      // Resize image
      const resized = image.resize(targetWidth, targetHeight);

      // Encode to JPEG with quality setting (smaller file size than PNG)
      const quality = size.name === 'blur' ? 10 : 80;
      const encodedBuffer = await resized.encodeJPEG(quality);

      if (size.name === 'blur') {
        // Convert blur image to base64 for inline use
        const base64 = btoa(String.fromCharCode(...encodedBuffer));
        optimizedUrls.blur_placeholder = `data:image/jpeg;base64,${base64}`;
        console.log(`Generated blur placeholder (${targetWidth}x${targetHeight})`);
      } else {
        // Upload optimized version to storage with .jpg extension
        const optimizedPath = `${originalPath.replace(/\.[^.]+$/, '')}-${size.name}.jpg`;

        const { error: uploadError } = await supabaseClient.storage
          .from(bucketName)
          .upload(optimizedPath, encodedBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for ${size.name}:`, uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabaseClient.storage
          .from(bucketName)
          .getPublicUrl(optimizedPath);

        optimizedUrls[`image_url_${size.name}`] = publicUrl;
        console.log(`Uploaded ${size.name} version (${targetWidth}x${targetHeight}): ${publicUrl}`);
      }
    }

    console.log('Image optimization completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        optimizedUrls 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error optimizing image:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
