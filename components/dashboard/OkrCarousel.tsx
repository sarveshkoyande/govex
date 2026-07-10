'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';

interface OkrCarouselCard {
  id: string;
  title: string;
  metrics?: string;
  tags?: string[];
}

interface OkrCarouselProps {
  okrs: OkrCarouselCard[];
}

/* Highlight numbers in text with bold blue styling */
function highlightNumbers(text: string) {
  const parts = text.split(/(\d+(?:\.\d+)?[a-zA-Z%]*)/g);
  return parts.map((part, i) =>
    /^\d+(?:\.\d+)?[a-zA-Z%]*$/.test(part)
      ? <span key={i} className="font-bold text-primary">{part}</span>
      : part
  );
}

const GAP = 16; // px — matches gap-4
const MIN_CARD_WIDTH = 220;

export function OkrCarousel({ okrs }: OkrCarouselProps) {
  const wrapperRef          = useRef<HTMLDivElement>(null);
  const scrollContainerRef  = useRef<HTMLDivElement>(null);
  const [cardWidth,         setCardWidth]       = useState(288);
  const [showLeftScroll,    setShowLeftScroll]  = useState(false);
  const [showRightScroll,   setShowRightScroll] = useState(true);

  /* Compute card width so N whole cards fill the container exactly */
  const computeCardWidth = useCallback(() => {
    if (!wrapperRef.current) return;
    const available = wrapperRef.current.clientWidth;
    // How many cards fit at minimum width?
    const count = Math.max(1, Math.floor((available + GAP) / (MIN_CARD_WIDTH + GAP)));
    const width = Math.floor((available - GAP * (count - 1)) / count);
    setCardWidth(width);
  }, []);

  useEffect(() => {
    computeCardWidth();
    const ro = new ResizeObserver(computeCardWidth);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [computeCardWidth]);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftScroll(scrollLeft > 4);
    setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 4);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = (cardWidth + GAP) * Math.max(1, Math.floor(scrollContainerRef.current.clientWidth / (cardWidth + GAP)));
    scrollContainerRef.current.scrollTo({
      left: scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount),
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 350);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <style>{`
        .okr-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .okr-hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Scroll container — starts flush left, no padding */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="okr-hide-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-4"
      >
        {okrs.map((okr, index) => (
          <div
            key={okr.id}
            className="flex-shrink-0 rounded-lg border border-blue-200/40 bg-white p-4 hover:border-primary/50 transition-all cursor-pointer"
            style={{ width: cardWidth }}
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
              {okr.tags && okr.tags.map((tag) => (
                <span key={tag} className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-semibold uppercase tracking-widest">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-semibold leading-snug text-foreground mb-3">
              {highlightNumbers(okr.title)}
            </h3>
            {okr.metrics && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {highlightNumbers(okr.metrics)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Overlay nav buttons — absolutely positioned so they don't affect card alignment */}
      {showLeftScroll && (
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-background border border-border hover:bg-muted transition-all shadow-md"
        >
          <ChevronLeft size={18} className="text-primary" />
        </button>
      )}
      {showRightScroll && (
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 p-2 rounded-full bg-background border border-border hover:bg-muted transition-all shadow-md"
        >
          <ChevronRight size={18} className="text-primary" />
        </button>
      )}
    </div>
  );
}
