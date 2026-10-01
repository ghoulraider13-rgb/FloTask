import { useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

/**
 * Swipeable full-height screens for phone widths (Embla Carousel).
 * Kept in sync with the bottom tab bar:
 *  - tab click  → emblaApi.scrollTo(index, immediate)
 *  - swipe      → 'select' event reports the active index upward
 *
 * `suppressSwipeOnSelectors` — gestures starting on elements matched by
 * these selectors are never claimed by the carousel (Embla watchDrag
 * decides at pointer-down): the scratchpad text area keeps native text
 * selection/scrolling, and swipe-to-delete rows keep their own
 * horizontal gesture. On those rows, switch screens via the tab bar or
 * by swiping on non-row areas.
 *
 * The options object is created once per mount: Embla re-inits when the
 * options identity changes, and watchDrag reads the live selectors from
 * a ref, so suppression stays current without re-initializing.
 */
export default function SwipeCarousel({
  screens,
  activeIndex,
  onActiveIndexChange,
  suppressSwipeOnSelectors = [],
}) {
  const suppressRef = useRef(suppressSwipeOnSelectors.join(','));
  const optionsRef = useRef({
    loop: false,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    watchDrag: (emblaApi, event) => {
      const target = event?.target;
      const sel = suppressRef.current;
      if (!sel || !target) return true;
      return !target.closest(sel);
    },
  }).current;

  const [emblaRef, emblaApi] = useEmblaCarousel(optionsRef);

  const onChangeRef = useRef(onActiveIndexChange);
  onChangeRef.current = onActiveIndexChange;

  // Tab click → carousel (immediate jump, no tween).
  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex, true);
    }
  }, [emblaApi, activeIndex]);

  // Swipe → tabs.
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => onChangeRef.current?.(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  return (
    <div className="h-full overflow-hidden" ref={emblaRef}>
      <div className="flex h-full touch-pan-y">
        {screens.map((screen) => (
          <div
            key={screen.id}
            className="flex-[0_0_100%] min-w-0 h-full overflow-y-auto overscroll-contain"
            data-screen={screen.id}
            style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
          >
            {screen.content}
          </div>
        ))}
      </div>
    </div>
  );
}
