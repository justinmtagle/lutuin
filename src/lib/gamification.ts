export const XP_VALUES = {
  cooking_session: 15,
  rate_dish: 5,
  add_ingredient: 2,
  chat_message: 3,
  get_suggestion: 3,
  unlock_achievement: 20,
} as const;

export const LEVELS = [
  { level: 1, xpRequired: 0, title: "Kitchen Newbie" },
  { level: 2, xpRequired: 100, title: "Rice Washer" },
  { level: 3, xpRequired: 300, title: "Home Cook" },
  { level: 4, xpRequired: 600, title: "Kusina Regular" },
  { level: 5, xpRequired: 1000, title: "Aspiring Chef" },
  { level: 6, xpRequired: 1500, title: "Sinigang Master" },
  { level: 7, xpRequired: 2500, title: "Lutong Bahay Pro" },
  { level: 8, xpRequired: 4000, title: "Chef Luto's Apprentice" },
  { level: 9, xpRequired: 6000, title: "Master Chef" },
  { level: 10, xpRequired: 10000, title: "Legendary Filipino Chef" },
] as const;

export const QUEST_POOL = [
  { type: "cook_any", description: "Cook any dish today" },
  { type: "cook_with_chicken", description: "Cook a dish with chicken" },
  { type: "cook_with_pork", description: "Cook a dish with pork" },
  { type: "try_new_recipe", description: "Try a recipe you haven't cooked before" },
  { type: "add_ingredients", description: "Add 3 ingredients to your kusina" },
  { type: "chat_chef", description: "Ask Chef Luto for cooking advice" },
  { type: "rate_dish", description: "Rate a dish you've cooked" },
  { type: "get_suggestion", description: "Get a dish suggestion from Chef Luto" },
] as const;

export function getLevelForXP(xp: number): (typeof LEVELS)[number] {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(currentLevel: number): (typeof LEVELS)[number] | null {
  const idx = LEVELS.findIndex((l) => l.level === currentLevel);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
