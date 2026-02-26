"use client";

import { useEffect, useState } from "react";

type AchievementToastProps = {
  achievement: {
    name: string;
    description: string;
    hidden: boolean;
  };
  onDismiss: () => void;
};

export default function AchievementToast({
  achievement,
  onDismiss,
}: AchievementToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    requestAnimationFrame(() => {
      setVisible(true);
    });

    // After 5 seconds, trigger exit animation then dismiss
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onDismiss();
      }, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl shadow-xl px-6 py-4 flex items-start gap-3 min-w-[300px] max-w-[400px]">
        <span className="text-3xl">🏆</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">
            {achievement.hidden
              ? "Secret Achievement!"
              : "Achievement Unlocked!"}
          </span>
          <span className="font-semibold">{achievement.name}</span>
          <span className="text-amber-100 text-xs">
            {achievement.description}
          </span>
        </div>
      </div>
    </div>
  );
}
