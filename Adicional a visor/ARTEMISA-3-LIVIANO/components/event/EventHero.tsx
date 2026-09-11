"use client";

import { eventInfo } from "@/lib/event-data";
import { motion } from "framer-motion";

export function EventHero() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative flex flex-col items-center justify-center min-h-screen px-8 py-12 overflow-hidden"
    >
      {/* Fondo con efecto de textura */}
      <div className="absolute inset-0 bg-primary/90" />
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative z-10 text-center max-w-5xl mx-auto">
        {/* Venue */}
        <motion.p
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-foreground/80 text-xl md:text-2xl tracking-[0.3em] uppercase mb-8"
        >
          {eventInfo.venue}
        </motion.p>

        {/* Título principal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8">
            <div className="text-left leading-[0.9]">
              <span className="block font-serif text-accent text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight lowercase">
                arte
              </span>
              <span className="block font-sans text-foreground text-6xl md:text-8xl lg:text-9xl font-bold uppercase">
                MISA
              </span>
            </div>
            <span className="font-sans text-foreground/90 text-7xl md:text-9xl lg:text-[9.25rem] font-semibold">
              {eventInfo.edition}
            </span>
          </h1>
        </motion.div>

        {/* Fecha y hora */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="space-y-2 mb-10"
        >
          <p className="text-foreground text-4xl md:text-5xl font-bold tracking-wider">
            [ {eventInfo.date} ]
          </p>
          <p className="text-foreground/90 text-2xl md:text-3xl">
            {eventInfo.time}
          </p>
        </motion.div>

        {/* Highlights */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-4 md:gap-5"
        >
          {eventInfo.highlights.map((highlight, index) => (
            <span
              key={highlight}
              className={`px-5 py-2 text-base md:text-lg font-medium tracking-wide ${
                index === 0 
                  ? "text-accent font-bold" 
                  : "text-foreground/80"
              }`}
            >
              {highlight}
            </span>
          ))}
        </motion.div>

        {/* Dirección */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-14 text-foreground/60 text-xl md:text-2xl"
        >
          {eventInfo.address}
        </motion.p>
      </div>
    </motion.div>
  );
}
