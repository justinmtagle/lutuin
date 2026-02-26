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

export default function AchievementGrid({
  achievements,
}: {
  achievements: AchievementDisplay[];
}) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const sorted = [...achievements].sort(
    (a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-stone-800">Achievements</h2>
        <span className="text-sm text-stone-400">
          {unlockedCount}/{achievements.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((a) => {
          const icon = a.unlocked
            ? "\u{1F3C6}"
            : a.hidden
              ? "\u{2753}"
              : "\u{1F512}";

          const showProgress =
            !a.unlocked && !a.hidden && a.progress && a.target;

          return (
            <div
              key={a.slug}
              className={`p-3 rounded-xl border ${
                a.unlocked
                  ? "bg-amber-50 border-amber-200"
                  : "bg-stone-50 border-stone-200 opacity-60"
              }`}
            >
              <div className="text-lg">{icon}</div>
              <div
                className={`text-sm font-semibold truncate ${
                  a.unlocked ? "text-amber-700" : "text-stone-400"
                }`}
              >
                {a.name}
              </div>
              <div className="text-xs text-stone-400 truncate">
                {a.description}
              </div>
              {showProgress && a.progress && a.target && (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-stone-200 rounded-full">
                    <div
                      className="h-1.5 bg-amber-400 rounded-full"
                      style={{
                        width: `${Math.min(
                          (a.progress.count / a.target) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {a.progress.count}/{a.target}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
