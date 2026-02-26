"use client";

import { useState, useCallback } from "react";
import AchievementToast from "./achievement-toast";

type AchievementNotification = {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
};

let showAchievementFn: ((achievements: AchievementNotification[]) => void) | null = null;

export function showAchievementToasts(achievements: AchievementNotification[]) {
  if (showAchievementFn) {
    showAchievementFn(achievements);
  }
}

export default function AchievementToastManager() {
  const [toasts, setToasts] = useState<AchievementNotification[]>([]);

  const addToasts = useCallback((achievements: AchievementNotification[]) => {
    setToasts((prev) => [...prev, ...achievements]);
  }, []);

  showAchievementFn = addToasts;

  const handleDismiss = useCallback(() => {
    setToasts((prev) => prev.slice(1));
  }, []);

  if (toasts.length === 0) return null;

  const current = toasts[0];

  return (
    <AchievementToast
      key={current.id}
      achievement={current}
      onDismiss={handleDismiss}
    />
  );
}
