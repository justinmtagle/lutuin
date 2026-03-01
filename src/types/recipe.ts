export type Recipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: { name: string; amount: string; note?: string | null }[];
  steps: {
    number: number;
    title: string;
    instruction: string;
    tip?: string | null;
  }[];
};

export type ChatRecipe = Omit<Recipe, "ingredients"> & {
  ingredients: (Recipe["ingredients"][number] & { in_pantry?: boolean })[];
};
