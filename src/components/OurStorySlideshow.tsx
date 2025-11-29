import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
  blur_placeholder?: string;
  image_url_sm?: string;
  image_url_md?: string;
  image_url_lg?: string;
}

export const OurStorySlideshow = () => {
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Convert path to full URL if needed
  const getFullUrl = (path: string | null | undefined) => {
    if (!path) return '';
    if (path.startsWith('http')) return path; // Already full URL
    if (path.startsWith('data:')) return path; // Base64 data URL
    // Relative path - construct full URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public${path}`;
  };

  // Get optimal image URL based on viewport width
  const getOptimalImageUrl = (image: SlideshowImage) => {
    if (typeof window === 'undefined') return getFullUrl(image.image_url);
    const width = window.innerWidth;
    if (width <= 768 && image.image_url_sm) return getFullUrl(image.image_url_sm);
    if (width <= 1440 && image.image_url_md) return getFullUrl(image.image_url_md);
    return getFullUrl(image.image_url_lg || image.image_url);
  };

  // Preload first image for faster LCP
  useEffect(() => {
    if (images.length > 0) {
      const firstImage = images[0];
      const optimalUrl = getOptimalImageUrl(firstImage);
      
      // Create preload link
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = optimalUrl;
      link.fetchPriority = 'high';
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [images]);

  useEffect(() => {
    fetchImages();

    // Set up real-time subscription for slideshow updates
    const channel = supabase
      .channel('our-story-slideshow-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'our_story_slideshow',
        },
        () => {
          fetchImages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('our_story_slideshow')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching our story slideshow images:', error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.offsetWidth;
    const maxScroll = container.scrollWidth - container.offsetWidth;
    
    if (direction === 'right') {
      // If at the end, wrap to beginning
      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollTo({ 
          left: container.scrollLeft + scrollAmount, 
          behavior: 'smooth' 
        });
      }
    } else {
      // If at the beginning, wrap to end
      if (container.scrollLeft <= 10) {
        container.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        container.scrollTo({ 
          left: container.scrollLeft - scrollAmount, 
          behavior: 'smooth' 
        });
      }
    }
  };

  if (loading || images.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full h-screen">
      <div className="relative w-full h-full">
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory h-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((image, index) => {
            const optimalUrl = getOptimalImageUrl(image);
            const isLoaded = loadedImages.has(image.id);
            const isFirstImage = index === 0;
            
            return (
              <div 
                key={image.id} 
                className="flex-none w-full h-full snap-start relative"
              >
                {/* Blur placeholder */}
                {image.blur_placeholder && !isLoaded && (
                  <img
                    src={image.blur_placeholder}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                    aria-hidden="true"
                  />
                )}
                
                {/* Main image */}
                <img
                  src={optimalUrl}
                  alt={`Our Story ${image.sequence_order + 1}`}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading={isFirstImage ? "eager" : "lazy"}
                  fetchPriority={isFirstImage ? "high" : "auto"}
                  onLoad={() => {
                    setLoadedImages(prev => new Set(prev).add(image.id));
                  }}
                />
              </div>
            );
          })}
        </div>
        
        {/* Desktop Navigation Arrows */}
        {!isMobile && images.length > 1 && (
          <>
            <button
              onClick={() => scroll('left')}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-3 transition-all z-10"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-3 transition-all z-10"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </section>
  );
};
