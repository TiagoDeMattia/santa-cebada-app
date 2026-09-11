"use client";

import { motion } from "framer-motion";
import { produceIdeal } from "@/lib/event-data";

export function ProduceIdealPanel() {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=24&data=${encodeURIComponent(produceIdeal.instagramUrl)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex items-center justify-center px-8 py-12 bg-background overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.16),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-7xl rounded-[2rem] border border-foreground/15 bg-black/25 backdrop-blur-sm px-8 py-10 md:px-20 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="text-center md:text-left">
            <p className="text-foreground/70 text-xl md:text-3xl uppercase tracking-[0.28em] mb-6">
              Partner Creativo
            </p>
            <img
              src={produceIdeal.logo}
              alt={produceIdeal.name}
              className="w-full max-w-[420px] md:max-w-[520px] h-auto mx-auto md:mx-0 mb-8 rounded-xl bg-black/40 p-2"
            />
            <p className="text-foreground/80 text-3xl md:text-5xl mb-2">
              Seguilos en Instagram:
            </p>
            <p className="text-foreground/60 text-2xl md:text-3xl">@{produceIdeal.instagramHandle}</p>
          </div>

          <div className="mx-auto w-full max-w-[380px] md:max-w-[460px]">
            <div className="rounded-[1.6rem] border border-accent/40 bg-white p-4 md:p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
              <img
                src={qrUrl}
                alt="QR de Instagram de Produce Ideal Ambiente"
                className="w-full h-auto rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
