"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { rotationConfig } from "@/lib/event-data";
import { EventHero } from "./EventHero";
import { SchedulePanel } from "./SchedulePanel";
import { VendorsPanel } from "./VendorsPanel";
import { SponsorsStrip } from "./SponsorsStrip";
import { InstagramVideosPanel } from "./InstagramVideosPanel";
import { ProduceIdealPanel } from "./ProduceIdealPanel";
import { NowPlayingPanel } from "./NowPlayingPanel";

type SlideType = (typeof rotationConfig.slideOrder)[number];

const slideComponents: Record<SlideType, React.ComponentType> = {
  hero: EventHero,
  schedule: SchedulePanel,
  nowPlaying: NowPlayingPanel,
  videos: InstagramVideosPanel,
  produceIdeal: ProduceIdealPanel,
  vendors: VendorsPanel,
  sponsors: SponsorsStrip,
};

export function RotatingLayout() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentSlide = rotationConfig.slideOrder[currentSlideIndex];
  const SlideComponent = slideComponents[currentSlide];

  // Avanzar al siguiente slide
  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => 
      (prev + 1) % rotationConfig.slideOrder.length
    );
  }, []);

  // Retroceder al slide anterior
  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => 
      prev === 0 ? rotationConfig.slideOrder.length - 1 : prev - 1
    );
  }, []);

  // Rotación automática
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(nextSlide, rotationConfig.mainSlideInterval);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  // Controles de teclado
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          nextSlide();
          break;
        case "ArrowLeft":
          prevSlide();
          break;
        case "p":
        case "P":
          setIsPaused((prev) => !prev);
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const index = parseInt(e.key, 10) - 1;
            if (index < rotationConfig.slideOrder.length) {
              setCurrentSlideIndex(index);
            }
          }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        <SlideComponent key={currentSlide} />
      </AnimatePresence>

      {/* Indicadores de slide */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        {rotationConfig.slideOrder.map((slide, index) => (
          <button
            key={slide}
            onClick={() => setCurrentSlideIndex(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === currentSlideIndex
                ? "bg-accent w-8"
                : "bg-foreground/30 hover:bg-foreground/50 w-2.5"
            }`}
            aria-label={`Ir a ${slide}`}
          />
        ))}
      </div>

      {/* Indicador de pausa */}
      {isPaused && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-accent/20 text-accent text-sm rounded-full z-50">
          PAUSADO
        </div>
      )}

      {/* Controles ocultos (visibles en hover) */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none z-40">
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto">
          <p className="text-foreground/40 text-xs text-center">
            ← → Navegar | P Pausar | 1-{rotationConfig.slideOrder.length} Ir a slide
          </p>
        </div>
      </div>
    </div>
  );
}
