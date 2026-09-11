"use client";

import { closingMessage, eventInfo } from "@/lib/event-data";
import { motion } from "framer-motion";

export function ClosingMessage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-8 py-12 bg-primary"
    >
      <div className="text-center">
        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="font-serif text-foreground text-5xl md:text-7xl lg:text-8xl font-bold mb-4"
        >
          {closingMessage.title}
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-accent text-2xl md:text-3xl"
        >
          {closingMessage.subtitle}
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-12"
        >
          <p className="text-foreground/60 text-lg">
            {eventInfo.title} {eventInfo.edition} — {eventInfo.venue}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
