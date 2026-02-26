"use client";

import { useState } from "react";
import AchievementGrid from "./achievement-grid";

type AchievementDisplay = {
  slug: string;
  name: string;
  description: string;
  hidden: boolean;
  target: number | null;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { count: number; target: number } | null;
};

export default function AchievementPanel({
  achievements,
}: {
  achievements: AchievementDisplay[];
}) {
  const [open, setOpen] = useState(false);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-2xl rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="View achievements"
      >
        {"\u{1F3C6}"}
        <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-amber-700 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
          {unlockedCount}
        </span>
      </button>

      {/* Bottom Sheet Backdrop + Panel */}
      {open && (
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-stone-300 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-4 text-stone-400 hover:text-stone-600 text-xl"
              aria-label="Close achievements"
            >
              ✕
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-4 pb-6">
              <AchievementGrid achievements={achievements} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
