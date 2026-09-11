"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { instagramVideos, rotationConfig } from "@/lib/event-data";

let nextStartingVideoIndex = 0;

export function InstagramVideosPanel() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const totalVideos = instagramVideos.length;
    if (!totalVideos) return;

    const firstIndex = nextStartingVideoIndex % totalVideos;
    const secondIndex = (firstIndex + 1) % totalVideos;

    setCurrentVideoIndex(firstIndex);
    nextStartingVideoIndex = (firstIndex + 2) % totalVideos;

    if (totalVideos <= 1) return;

    const timeout = setTimeout(() => {
      setCurrentVideoIndex(secondIndex);
    }, rotationConfig.videoRotationInterval);

    return () => clearTimeout(timeout);
  }, []);

  if (!instagramVideos.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-8 text-center">
        <p className="text-foreground/80 text-2xl md:text-4xl">
          Pasame links de Instagram y te los cargo como videos.
        </p>
      </div>
    );
  }

  const activeVideo = instagramVideos[currentVideoIndex];
  const hasError = failedVideos[activeVideo.id] ?? false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="relative min-h-screen flex flex-col items-center justify-center px-8 py-10 bg-background"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_60%)]" />

      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="mx-auto h-[82vh] max-h-[1080px] aspect-[9/16] rounded-[2rem] border border-foreground/20 bg-black/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] bg-black">
            {hasError ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                <p className="text-foreground/80 text-xl md:text-2xl leading-relaxed">
                  Falta este video en <span className="text-accent font-semibold">{activeVideo.url}</span>
                </p>
              </div>
            ) : (
              <video
                key={activeVideo.id}
                src={activeVideo.url}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={() =>
                  setFailedVideos((prev) => ({
                    ...prev,
                    [activeVideo.id]: true,
                  }))
                }
                className="h-full w-full object-contain"
              />
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {instagramVideos.map((video, index) => (
            <span
              key={video.id}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentVideoIndex ? "w-10 bg-accent" : "w-2.5 bg-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
