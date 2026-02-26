// Run with: npx tsx scripts/seed-ingredients.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ingredients = [
  // Proteins
  { name: "Chicken", category: "protein", common_in_ph: true },
  { name: "Pork Belly", category: "protein", common_in_ph: true },
  { name: "Pork Shoulder", category: "protein", common_in_ph: true },
  { name: "Ground Pork", category: "protein", common_in_ph: true },
  { name: "Bangus (Milkfish)", category: "protein", common_in_ph: true },
  { name: "Tilapia", category: "protein", common_in_ph: true },
  { name: "Shrimp", category: "protein", common_in_ph: true },
  { name: "Squid", category: "protein", common_in_ph: true },
  { name: "Beef", category: "protein", common_in_ph: true },
  { name: "Eggs", category: "protein", common_in_ph: true },
  { name: "Tofu", category: "protein", common_in_ph: true },

  // Vegetables
  { name: "Onion", category: "vegetable", common_in_ph: true },
  { name: "Garlic", category: "vegetable", common_in_ph: true },
  { name: "Tomato", category: "vegetable", common_in_ph: true },
  { name: "Ginger", category: "vegetable", common_in_ph: true },
  { name: "Kangkong (Water Spinach)", category: "vegetable", common_in_ph: true },
  { name: "Sitaw (String Beans)", category: "vegetable", common_in_ph: true },
  { name: "Eggplant", category: "vegetable", common_in_ph: true },
  { name: "Ampalaya (Bitter Melon)", category: "vegetable", common_in_ph: true },
  { name: "Kalabasa (Squash)", category: "vegetable", common_in_ph: true },
  { name: "Sayote (Chayote)", category: "vegetable", common_in_ph: true },
  { name: "Green Beans", category: "vegetable", common_in_ph: true },
  { name: "Pechay (Bok Choy)", category: "vegetable", common_in_ph: true },
  { name: "Potato", category: "vegetable", common_in_ph: true },
  { name: "Carrots", category: "vegetable", common_in_ph: true },
  { name: "Green Chili (Siling Haba)", category: "vegetable", common_in_ph: true },
  { name: "Bell Pepper", category: "vegetable", common_in_ph: true },

  // Fruits
  { name: "Calamansi", category: "fruit", common_in_ph: true },
  { name: "Tamarind", category: "fruit", common_in_ph: true },
  { name: "Green Mango", category: "fruit", common_in_ph: true },
  { name: "Banana (Saba)", category: "fruit", common_in_ph: true },

  // Spices
  { name: "Bay Leaves", category: "spice", common_in_ph: true },
  { name: "Black Pepper", category: "spice", common_in_ph: true },
  { name: "Salt", category: "spice", common_in_ph: true },
  { name: "Paprika", category: "spice", common_in_ph: false },
  { name: "Chili Flakes", category: "spice", common_in_ph: true },
  { name: "Annatto (Atsuete)", category: "spice", common_in_ph: true },

  // Pantry staples
  { name: "Rice", category: "pantry_staple", common_in_ph: true },
  { name: "Cooking Oil", category: "pantry_staple", common_in_ph: true },
  { name: "All-Purpose Flour", category: "pantry_staple", common_in_ph: true },
  { name: "Cornstarch", category: "pantry_staple", common_in_ph: true },
  { name: "Brown Sugar", category: "pantry_staple", common_in_ph: true },
  { name: "White Sugar", category: "pantry_staple", common_in_ph: true },

  // Sauces & Condiments
  { name: "Soy Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Vinegar", category: "sauce_condiment", common_in_ph: true },
  { name: "Fish Sauce (Patis)", category: "sauce_condiment", common_in_ph: true },
  { name: "Oyster Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Shrimp Paste (Bagoong)", category: "sauce_condiment", common_in_ph: true },
  { name: "Tomato Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Banana Ketchup", category: "sauce_condiment", common_in_ph: true },
  { name: "Coconut Milk", category: "sauce_condiment", common_in_ph: true },
  { name: "Coconut Cream", category: "sauce_condiment", common_in_ph: true },
  { name: "Worcestershire Sauce", category: "sauce_condiment", common_in_ph: false },
];

async function seed() {
  const { data, error } = await supabase
    .from("ingredients")
    .upsert(ingredients, { onConflict: "name" })
    .select();

  if (error) {
    console.error("Error seeding ingredients:", error);
  } else {
    console.log(`Seeded ${data.length} ingredients`);
  }
}

seed();
