export type TriggerType =
  | "cooking_session"
  | "pantry_update"
  | "chat_message"
  | "profile_update";

export type Achievement = {
  slug: string;
  name: string;
  description: string;
  hidden: boolean;
  target: number | null;
  trigger: TriggerType;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ── Visible achievements ──────────────────────────────────────────────
  {
    slug: "first_dish",
    name: "First Dish",
    description: "Complete your first cooking session",
    hidden: false,
    target: 1,
    trigger: "cooking_session",
  },
  {
    slug: "home_cook",
    name: "Home Cook",
    description: "Complete 10 cooking sessions",
    hidden: false,
    target: 10,
    trigger: "cooking_session",
  },
  {
    slug: "kitchen_master",
    name: "Kitchen Master",
    description: "Complete 50 cooking sessions",
    hidden: false,
    target: 50,
    trigger: "cooking_session",
  },
  {
    slug: "explorer",
    name: "Explorer",
    description: "Cook 5 different recipes",
    hidden: false,
    target: 5,
    trigger: "cooking_session",
  },
  {
    slug: "adventurer",
    name: "Adventurer",
    description: "Cook 15 different recipes",
    hidden: false,
    target: 15,
    trigger: "cooking_session",
  },
  {
    slug: "pantry_pro",
    name: "Pantry Pro",
    description: "Add 20 ingredients to your kusina",
    hidden: false,
    target: 20,
    trigger: "pantry_update",
  },
  {
    slug: "streak_3",
    name: "On a Roll",
    description: "Cook 3 days in a row",
    hidden: false,
    target: 3,
    trigger: "cooking_session",
  },
  {
    slug: "streak_7",
    name: "Week Warrior",
    description: "Cook 7 days in a row",
    hidden: false,
    target: 7,
    trigger: "cooking_session",
  },
  {
    slug: "rising_chef",
    name: "Rising Chef",
    description: "Reach intermediate skill level",
    hidden: false,
    target: null,
    trigger: "profile_update",
  },
  {
    slug: "master_chef",
    name: "Master Chef",
    description: "Reach advanced skill level",
    hidden: false,
    target: null,
    trigger: "profile_update",
  },

  // ── Hidden achievements ───────────────────────────────────────────────
  {
    slug: "perfect_score",
    name: "Perfect Score",
    description: "Rate a dish 5 stars",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "night_owl",
    name: "Night Owl",
    description: "Complete a cooking session after 10 PM",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "early_bird",
    name: "Early Bird",
    description: "Complete a cooking session before 7 AM",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "comfort_food",
    name: "Comfort Food",
    description: "Cook the same recipe 3 times",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "fearless",
    name: "Fearless",
    description: "Complete a recipe you found too hard",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "chatty_chef",
    name: "Chatty Chef",
    description: "Send 50+ messages to Chef Luto",
    hidden: true,
    target: null,
    trigger: "chat_message",
  },
  {
    slug: "full_kusina",
    name: "Full Kusina",
    description: "Have 30+ ingredients in your pantry",
    hidden: true,
    target: null,
    trigger: "pantry_update",
  },
];

// ── Helper functions ──────────────────────────────────────────────────────

export function getAchievement(slug: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.slug === slug);
}

export function getAchievementsByTrigger(trigger: TriggerType): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.trigger === trigger);
}
