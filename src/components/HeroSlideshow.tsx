import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideshowImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

export const HeroSlideshow = () => {
  const [images, setImages] = useState<SlideshowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    fetchImages();

    // Set up real-time subscription for slideshow updates
    const channel = supabase
      .channel('slideshow-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slideshow_images',
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
        .from('slideshow_images')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching slideshow images:', error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = useCallback((direction: 'left' | 'right') => {
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
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        scroll('right');
      } else {
        scroll('left');
      }
    }
  };

  // Track current slide index
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const index = Math.round(container.scrollLeft / container.offsetWidth);
      setCurrentIndex(index);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Listen for swipe events from hero content
  useEffect(() => {
    const handleHeroSwipe = (e: CustomEvent<{ direction: 'left' | 'right' }>) => {
      scroll(e.detail.direction);
    };

    window.addEventListener('hero-swipe', handleHeroSwipe as EventListener);
    return () => window.removeEventListener('hero-swipe', handleHeroSwipe as EventListener);
  }, [scroll]);

  if (loading || images.length === 0) {
    return (
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-br from-black/60 to-black/40" />
    );
  }

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
              alt={`SuiteSpot hero ${image.sequence_order + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-black/5 pointer-events-none" />
      
      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              scroll('left');
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-3 transition-all z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              scroll('right');
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full p-3 transition-all z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image Indicators - Hidden on desktop, shown on mobile */}
      {images.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-10 sm:hidden">
          {images.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-6' 
                  : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Export current index for parent components to use
export type { SlideshowImage };
