import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SuiteLightboxProps {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const SuiteLightbox = ({ photos, initialIndex, open, onClose }: SuiteLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const touchDeltaY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeOpacity, setSwipeOpacity] = useState(1);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      requestAnimationFrame(() => setIsAnimatingIn(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimatingIn(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    touchDeltaY.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
    
    if (Math.abs(touchDeltaX.current) > Math.abs(touchDeltaY.current)) {
      setSwipeOffset(touchDeltaX.current);
    } else if (touchDeltaY.current > 0) {
      setSwipeOpacity(Math.max(0.3, 1 - touchDeltaY.current / 300));
    }
  };

  const handleTouchEnd = () => {
    const threshold = 50;
    if (Math.abs(touchDeltaX.current) > Math.abs(touchDeltaY.current)) {
      if (touchDeltaX.current < -threshold) goNext();
      else if (touchDeltaX.current > threshold) goPrev();
    } else if (touchDeltaY.current > threshold * 1.5) {
      onClose();
    }
    setSwipeOffset(0);
    setSwipeOpacity(1);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ opacity: swipeOpacity }}
      onClick={(e) => { if (e.target === containerRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isAnimatingIn ? 'opacity-95' : 'opacity-0'}`}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 text-white/80 text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Image */}
      <div
        className={`relative z-[1] max-w-[90vw] max-h-[85vh] transition-all duration-300 ${isAnimatingIn ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
        style={{ transform: `translateX(${swipeOffset}px) scale(${isAnimatingIn ? 1 : 0.9})` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentIndex}
          src={photos[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-[85vh] object-contain rounded-lg animate-in fade-in duration-200"
          draggable={false}
        />
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 12 && (
        <div className="absolute bottom-6 z-10 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SuiteLightbox;
