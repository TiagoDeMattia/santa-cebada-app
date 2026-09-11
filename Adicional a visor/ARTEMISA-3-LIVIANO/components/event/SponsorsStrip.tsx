"use client";

import { sponsors, eventInfo } from "@/lib/event-data";
import { motion } from "framer-motion";

export function SponsorsStrip() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-8 py-12 bg-background"
    >
      {/* Logo principal (firma) */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="text-center mb-16"
      >
        <img
          src="/firma-logo.png"
          alt="Firma Artemisa"
          className="w-[320px] md:w-[520px] lg:w-[640px] h-auto mx-auto object-contain"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-foreground/60 text-xl md:text-2xl mt-6 tracking-wide"
        >
          {eventInfo.tagline}
        </motion.p>
      </motion.div>

      {/* Sponsors grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex flex-wrap justify-center items-center gap-6 md:gap-8"
      >
        {sponsors.map((sponsor, index) => (
          <motion.div
            key={sponsor.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + index * 0.15, duration: 0.4 }}
            className="text-center"
          >
            {sponsor.logo ? (
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className="h-12 md:h-14 lg:h-16 w-auto object-contain"
              />
            ) : (
              <span className="text-foreground/70 text-2xl md:text-3xl font-semibold uppercase tracking-wider">
                {sponsor.name}
              </span>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Cervezas disponibles */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 text-center"
      >
        <p className="text-accent text-base md:text-lg uppercase tracking-[0.3em] mb-4">
          Canillas Fijas
        </p>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-foreground/70 text-base md:text-lg">
          {["Amber Lager", "Honey", "Light Lager", "Scottish", "Stout", "Session IPA", "American IPA", "Red IPA", "APA"].map((beer) => (
            <span key={beer} className="px-3 py-1 border border-foreground/20 rounded-full">
              {beer}
            </span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
