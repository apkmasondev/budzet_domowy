import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

const screenshots = Array.from({ length: 12 }, (_, i) => `/budzet_domowy/screenshots/screenshot-${i + 1}.webp`);

export default function Gallery() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  // Handle body scroll locking
  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedIndex]);

  const showNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % screenshots.length);
    }
  }, [selectedIndex]);

  const showPrev = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + screenshots.length) % screenshots.length);
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowRight') showNext();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'Escape') closeLightbox();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, showNext, showPrev]);

  return (
    <section id="gallery" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Galeria Aplikacji</h2>
          <p className="text-text-muted text-lg">
            Zobacz jak prezentuje się Domowy Budżet w praktyce. Przejrzysty interfejs i potężne funkcje na wyciągnięcie ręki.
          </p>
        </div>

        {/* Thumbnails Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {screenshots.map((src, index) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group relative cursor-pointer rounded-xl overflow-hidden glass-card border border-white/10 aspect-video"
              onClick={() => openLightbox(index)}
            >
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center backdrop-blur-sm">
                <Maximize2 className="text-white drop-shadow-lg" size={32} />
              </div>
              <img
                src={src}
                alt={`Screenshot ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl"
            onClick={closeLightbox}
          >
            {/* Top Bar with Close Button */}
            <div className="absolute top-4 right-4 z-50">
              <button
                onClick={closeLightbox}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10 backdrop-blur-md"
              >
                <X size={24} />
              </button>
            </div>

            {/* Previous Button */}
            <button
              onClick={(e) => { e.stopPropagation(); showPrev(); }}
              className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-2 md:p-4 bg-black/50 md:bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10 backdrop-blur-md z-50"
            >
              <ChevronLeft size={24} className="md:w-8 md:h-8" />
            </button>

            {/* Current Image */}
            <div 
              className="w-full h-full max-w-7xl max-h-[100vh] md:max-h-[90vh] px-0 md:px-24 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={selectedIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                src={screenshots[selectedIndex]}
                alt={`Screenshot ${selectedIndex + 1}`}
                className="max-w-full max-h-[100vh] md:max-h-full object-contain rounded-none md:rounded-lg drop-shadow-2xl"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-2 md:p-4 bg-black/50 md:bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10 backdrop-blur-md z-50"
            >
              <ChevronRight size={24} className="md:w-8 md:h-8" />
            </button>
            
            {/* Counter */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white/70 text-sm font-medium border border-white/10 backdrop-blur-md">
              {selectedIndex + 1} / {screenshots.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
