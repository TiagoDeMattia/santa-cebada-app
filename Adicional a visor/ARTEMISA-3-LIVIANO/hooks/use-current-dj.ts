"use client";

import { useState, useEffect } from "react";
import { lineupSchedule } from "@/lib/event-data";

interface DJSet {
  dj: string;
  startTime: string;
  endTime: string;
}

type EventStatus = "before" | "live" | "after";

interface UseCurrentDJReturn {
  currentDJ: DJSet | null;
  nextDJ: DJSet | null;
  status: EventStatus;
  currentTime: string;
}

// Combinar todos los sets en orden
const allSets: DJSet[] = [
  ...lineupSchedule.tarde.sets,
  ...lineupSchedule.noche.sets,
];

// Parsear hora en formato HH:MM a minutos desde medianoche
// Maneja horas después de medianoche (00:00 - 03:00) como día siguiente
function parseTimeToMinutes(time: string, isAfterMidnight = false): number {
  const [hours, minutes] = time.split(":").map(Number);
  let totalMinutes = hours * 60 + minutes;
  
  // Si la hora es entre 00:00 y 06:00, considerarla como día siguiente
  if (hours >= 0 && hours < 6) {
    totalMinutes += 24 * 60;
  }
  
  return totalMinutes;
}

// Obtener hora actual en Buenos Aires
function getBuenosAiresTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
}

export function useCurrentDJ(): UseCurrentDJReturn {
  const [state, setState] = useState<UseCurrentDJReturn>({
    currentDJ: null,
    nextDJ: null,
    status: "before",
    currentTime: "",
  });

  useEffect(() => {
    function updateCurrentDJ() {
      const now = getBuenosAiresTime();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      let currentTotalMinutes = currentHours * 60 + currentMinutes;
      
      // Ajustar para horas después de medianoche
      if (currentHours >= 0 && currentHours < 6) {
        currentTotalMinutes += 24 * 60;
      }

      const currentTime = `${currentHours.toString().padStart(2, "0")}:${currentMinutes
        .toString()
        .padStart(2, "0")}`;

      // Encontrar el set actual y el próximo
      let currentDJ: DJSet | null = null;
      let nextDJ: DJSet | null = null;

      for (let i = 0; i < allSets.length; i++) {
        const set = allSets[i];
        const startMinutes = parseTimeToMinutes(set.startTime);
        const endMinutes = parseTimeToMinutes(set.endTime);

        if (currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes) {
          currentDJ = set;
          nextDJ = allSets[i + 1] || null;
          break;
        }

        if (currentTotalMinutes < startMinutes && !nextDJ) {
          nextDJ = set;
        }
      }

      // Determinar el estado del evento
      const firstSetStart = parseTimeToMinutes(allSets[0].startTime);
      const lastSetEnd = parseTimeToMinutes(allSets[allSets.length - 1].endTime);

      let status: EventStatus = "before";
      if (currentTotalMinutes >= lastSetEnd) {
        status = "after";
      } else if (currentTotalMinutes >= firstSetStart) {
        status = "live";
      }

      setState({
        currentDJ,
        nextDJ,
        status,
        currentTime,
      });
    }

    // Actualizar inmediatamente y luego cada minuto
    updateCurrentDJ();
    const interval = setInterval(updateCurrentDJ, 60000);

    return () => clearInterval(interval);
  }, []);

  return state;
}
