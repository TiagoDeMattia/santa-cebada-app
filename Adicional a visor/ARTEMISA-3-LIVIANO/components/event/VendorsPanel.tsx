"use client";

import { vendors, eventInfo } from "@/lib/event-data";
import { motion } from "framer-motion";

export function VendorsPanel() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-8 py-12 overflow-hidden"
    >
      {/* Fondo violeta */}
      <div className="absolute inset-0 bg-primary" />
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Título */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="font-serif text-foreground text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            LOS ELEGIDOS
          </h2>
          <h2 className="font-serif text-foreground text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            DE ESTA <span className="text-accent">MISA</span>
          </h2>
        </motion.div>

        {/* Lista de vendors */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-4 mb-14"
        >
          {vendors.map((vendor, index) => (
            <motion.div
              key={vendor.name}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.08, duration: 0.4 }}
              className="flex items-center justify-center gap-3 text-xl md:text-2xl"
            >
              <span className="text-accent font-semibold">
                {vendor.name}
              </span>
              <span className="text-foreground/60">—</span>
              <span className="text-foreground/80">
                {vendor.description}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Fecha y hora */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="space-y-2"
        >
          <p className="text-foreground text-4xl md:text-5xl font-bold tracking-wider">
            [ {eventInfo.date} ]
          </p>
          <p className="text-foreground/80 text-2xl md:text-3xl">
            {eventInfo.time}
          </p>
        </motion.div>

        {/* Ubicación */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-10"
        >
          <p className="text-foreground font-bold text-2xl md:text-3xl uppercase tracking-wider">
            {eventInfo.venue}
          </p>
          <p className="text-foreground/70 text-xl md:text-2xl">
            {eventInfo.address}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
