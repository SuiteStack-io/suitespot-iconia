import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

export const OurStorySlideshow = () => {
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
          {images.map((image) => (
            <div 
              key={image.id} 
              className="flex-none w-full h-full snap-start"
            >
              <img
                src={image.image_url}
                alt={`Our Story ${image.sequence_order + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
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
