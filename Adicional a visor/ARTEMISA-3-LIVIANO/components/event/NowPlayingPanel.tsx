"use client";

import { motion } from "framer-motion";
import { eventInfo, lineupSchedule } from "@/lib/event-data";
import { useCurrentDJ } from "@/hooks/use-current-dj";

const firstSet = lineupSchedule.tarde.sets[0];

export function NowPlayingPanel() {
  const { currentDJ, nextDJ, status, currentTime } = useCurrentDJ();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-8 py-12 bg-background overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,168,75,0.12),transparent_65%)]" />

      <div className="relative z-10 max-w-6xl w-full text-center">
        <p className="text-foreground/70 text-2xl md:text-3xl tracking-[0.25em] uppercase mb-8">
          En Cabina Ahora
        </p>

        <p className="text-accent text-3xl md:text-4xl font-semibold mb-10">
          {currentTime} HS
        </p>

        {status === "before" && (
          <div className="space-y-6">
            <h2 className="font-serif text-foreground text-6xl md:text-8xl lg:text-9xl font-bold leading-tight">
              Empezamos
            </h2>
            <h3 className="font-serif text-accent text-6xl md:text-8xl lg:text-9xl font-bold leading-tight">
              Pronto
            </h3>
            <p className="text-foreground/80 text-3xl md:text-5xl font-semibold">
              Arrancamos a las {firstSet.startTime} HS
            </p>
            {nextDJ && (
              <p className="text-foreground/65 text-2xl md:text-4xl">
                Primer set: <span className="text-foreground font-bold">{nextDJ.dj}</span>
              </p>
            )}
          </div>
        )}

        {status === "live" && currentDJ && (
          <div className="space-y-6">
            <p className="text-foreground/70 text-3xl md:text-4xl uppercase tracking-[0.15em]">
              Está Tocando
            </p>
            <h2 className="font-serif text-accent text-6xl md:text-8xl lg:text-9xl font-bold leading-none">
              {currentDJ.dj}
            </h2>
            <p className="text-foreground/80 text-3xl md:text-5xl">
              {currentDJ.startTime} HS a {currentDJ.endTime} HS
            </p>
            {nextDJ && (
              <p className="text-foreground/65 text-2xl md:text-4xl">
                Sigue: <span className="text-foreground font-bold">{nextDJ.dj}</span>
              </p>
            )}
          </div>
        )}

        {status === "after" && (
          <div className="space-y-6">
            <h2 className="font-serif text-foreground text-6xl md:text-8xl lg:text-9xl font-bold">
              Cerramos por Hoy
            </h2>
            <p className="text-foreground/75 text-3xl md:text-5xl">
              Gracias por venir a {eventInfo.title} {eventInfo.edition}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
