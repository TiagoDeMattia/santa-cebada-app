"use client";

import { lineupSchedule, eventInfo } from "@/lib/event-data";
import { motion } from "framer-motion";

interface SchedulePanelProps {
  variant?: "tarde" | "noche" | "both";
}

export function SchedulePanel({ variant = "both" }: SchedulePanelProps) {
  const renderScheduleBlock = (
    scheduleKey: "tarde" | "noche",
    index: number
  ) => {
    const schedule = lineupSchedule[scheduleKey];
    
    return (
      <motion.div
        key={scheduleKey}
        initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 + index * 0.2, duration: 0.6 }}
        className="flex-1 min-w-[340px]"
      >
        {/* Header del bloque */}
        <div className="mb-8">
          <h2 className="font-sans text-foreground text-3xl md:text-4xl font-semibold tracking-[0.12em] lowercase">
            horario
          </h2>
          <h3 className="font-serif text-accent text-6xl md:text-7xl font-bold tracking-tight -mt-1 lowercase">
            {scheduleKey === "tarde" ? "tarde" : "noche"}
          </h3>
        </div>

        {/* Lista de sets */}
        <div className="space-y-5">
          {schedule.sets.map((set, setIndex) => (
            <motion.div
              key={set.dj}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + setIndex * 0.1, duration: 0.4 }}
              className="flex items-center justify-between py-4 border-t border-foreground/20"
            >
              <span className="font-sans text-xl md:text-2xl font-semibold tracking-wide text-foreground/90">
                {set.dj}
              </span>
              <span className="font-sans text-lg md:text-xl text-foreground/60">
                {set.startTime} HS a {set.endTime} HS
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex flex-col justify-center px-8 py-12 bg-background"
    >
      {/* Header del evento */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-16"
      >
        <p className="text-foreground/60 text-xl md:text-2xl tracking-[0.24em] uppercase">
          {eventInfo.venue}
        </p>
        <h1 className="font-sans text-accent text-5xl md:text-7xl lg:text-8xl font-bold mt-8 uppercase">
          {eventInfo.title} {eventInfo.edition}
        </h1>
        <p className="text-foreground/80 text-2xl md:text-3xl mt-3">
          [ {eventInfo.date} ] {eventInfo.time}
        </p>
      </motion.div>

      {/* Grid de horarios */}
      <div className="max-w-6xl mx-auto w-full">
        {variant === "both" ? (
          <div className="flex flex-col lg:flex-row gap-14 lg:gap-20">
            {renderScheduleBlock("tarde", 0)}
            {renderScheduleBlock("noche", 1)}
          </div>
        ) : (
          renderScheduleBlock(variant, 0)
        )}
      </div>
    </motion.div>
  );
}
