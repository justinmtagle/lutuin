// Run with: npx tsx scripts/seed-recipes.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getIngredientMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from("ingredients").select("id, name");
  const map: Record<string, string> = {};
  data?.forEach((i) => (map[i.name] = i.id));
  return map;
}

const recipes = [
  {
    name: "Chicken Adobo",
    description: "The quintessential Filipino dish \u2014 chicken braised in soy sauce, vinegar, garlic, and bay leaves.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 45,
    servings: 4,
    steps: [
      { step: 1, instruction: "In a large pot, combine chicken pieces, soy sauce, vinegar, crushed garlic, bay leaves, and black peppercorns.", tip: "Don't stir the vinegar once it starts simmering \u2014 let it cook down naturally for better flavor." },
      { step: 2, instruction: "Bring to a boil, then reduce heat and simmer for 30 minutes until chicken is tender.", tip: "The longer you simmer, the more tender the chicken gets." },
      { step: 3, instruction: "Remove chicken pieces and fry in a hot pan with oil until golden brown.", tip: "Pat the chicken dry before frying for crispier skin." },
      { step: 4, instruction: "Reduce the remaining sauce until slightly thickened. Pour over the fried chicken.", tip: null },
      { step: 5, instruction: "Serve hot over steamed rice.", tip: "Adobo tastes even better the next day as the flavors deepen." },
    ],
    ingredients: [
      { name: "Chicken", amount: "1 kg", unit: "pieces", is_optional: false },
      { name: "Soy Sauce", amount: "1/2", unit: "cup", is_optional: false },
      { name: "Vinegar", amount: "1/4", unit: "cup", is_optional: false },
      { name: "Garlic", amount: "1", unit: "head", is_optional: false },
      { name: "Bay Leaves", amount: "3", unit: "pieces", is_optional: false },
      { name: "Black Pepper", amount: "1", unit: "tsp", is_optional: false },
      { name: "Cooking Oil", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Rice", amount: "4", unit: "cups", is_optional: false },
    ],
  },
  {
    name: "Sinigang na Baboy",
    description: "A sour tamarind-based pork soup loaded with vegetables \u2014 the ultimate Filipino comfort food.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 60,
    servings: 6,
    steps: [
      { step: 1, instruction: "Boil pork pieces in a large pot of water. Skim off the scum that rises to the surface.", tip: "Using pork ribs or belly gives the best flavor." },
      { step: 2, instruction: "Add onion and tomato. Simmer for 30 minutes until pork is tender.", tip: null },
      { step: 3, instruction: "Add tamarind soup base (or fresh tamarind pulp). Stir well.", tip: "For a more natural sourness, boil fresh tamarind in water and strain." },
      { step: 4, instruction: "Add harder vegetables first (radish, string beans, eggplant). Cook 5 minutes.", tip: null },
      { step: 5, instruction: "Add kangkong and green chili. Season with fish sauce to taste.", tip: "Add kangkong last \u2014 it wilts quickly and overcooking makes it slimy." },
      { step: 6, instruction: "Serve hot with steamed rice.", tip: "Sinigang is traditionally a rainy-day comfort food." },
    ],
    ingredients: [
      { name: "Pork Belly", amount: "500", unit: "g", is_optional: false },
      { name: "Tamarind", amount: "1", unit: "packet sinigang mix", is_optional: false },
      { name: "Kangkong (Water Spinach)", amount: "1", unit: "bunch", is_optional: false },
      { name: "Sitaw (String Beans)", amount: "1", unit: "bundle", is_optional: false },
      { name: "Eggplant", amount: "2", unit: "pieces", is_optional: false },
      { name: "Tomato", amount: "2", unit: "pieces", is_optional: false },
      { name: "Onion", amount: "1", unit: "large", is_optional: false },
      { name: "Green Chili (Siling Haba)", amount: "3", unit: "pieces", is_optional: true },
      { name: "Fish Sauce (Patis)", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Rice", amount: "4", unit: "cups", is_optional: false },
    ],
  },
  {
    name: "Pancit Canton",
    description: "Stir-fried egg noodles with vegetables and meat \u2014 a Filipino party staple.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 25,
    servings: 4,
    steps: [
      { step: 1, instruction: "Cook canton noodles according to package directions. Drain and set aside.", tip: "Slightly undercook the noodles since they'll continue cooking in the pan." },
      { step: 2, instruction: "Saute garlic and onion in oil until fragrant. Add sliced chicken or pork, cook through.", tip: null },
      { step: 3, instruction: "Add carrots and green beans. Stir-fry for 2-3 minutes.", tip: null },
      { step: 4, instruction: "Add soy sauce, oyster sauce, and a splash of water. Toss in the noodles.", tip: "Keep the heat high and toss quickly so noodles don't clump." },
      { step: 5, instruction: "Toss everything together until well combined. Squeeze calamansi on top before serving.", tip: "The calamansi brightens everything \u2014 don't skip it!" },
    ],
    ingredients: [
      { name: "Chicken", amount: "200", unit: "g", is_optional: false },
      { name: "Garlic", amount: "4", unit: "cloves", is_optional: false },
      { name: "Onion", amount: "1", unit: "medium", is_optional: false },
      { name: "Carrots", amount: "1", unit: "medium", is_optional: false },
      { name: "Green Beans", amount: "100", unit: "g", is_optional: false },
      { name: "Soy Sauce", amount: "3", unit: "tbsp", is_optional: false },
      { name: "Oyster Sauce", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Calamansi", amount: "4", unit: "pieces", is_optional: false },
      { name: "Cooking Oil", amount: "2", unit: "tbsp", is_optional: false },
    ],
  },
];

async function seed() {
  const ingredientMap = await getIngredientMap();

  for (const recipe of recipes) {
    const { ingredients: recipeIngredients, ...recipeData } = recipe;

    const { data: insertedRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert(recipeData)
      .select()
      .single();

    if (recipeError) {
      console.error(`Error inserting ${recipe.name}:`, recipeError);
      continue;
    }

    const mappings = recipeIngredients
      .filter((ri) => ingredientMap[ri.name])
      .map((ri) => ({
        recipe_id: insertedRecipe.id,
        ingredient_id: ingredientMap[ri.name],
        amount: ri.amount,
        unit: ri.unit,
        is_optional: ri.is_optional,
      }));

    const { error: mappingError } = await supabase
      .from("recipe_ingredients")
      .insert(mappings);

    if (mappingError) {
      console.error(`Error inserting ingredients for ${recipe.name}:`, mappingError);
    } else {
      console.log(`Seeded: ${recipe.name} (${mappings.length} ingredients)`);
    }
  }
}

seed();
