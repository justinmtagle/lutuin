"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SkillStep from "@/components/onboarding/skill-step";
import DietaryStep from "@/components/onboarding/dietary-step";
import PantryStep from "@/components/onboarding/pantry-step";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [dietary, setDietary] = useState<string[]>(["No restrictions"]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleComplete() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Update profile
    await supabase
      .from("profiles")
      .update({
        skill_level: skillLevel,
        dietary_restrictions: dietary.includes("No restrictions") ? [] : dietary,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    // Add pantry items — look up ingredient IDs by name
    if (pantryItems.length > 0) {
      const { data: ingredients } = await supabase
        .from("ingredients")
        .select("id, name")
        .in("name", pantryItems);

      if (ingredients && ingredients.length > 0) {
        await supabase.from("user_pantry").insert(
          ingredients.map((ing) => ({
            user_id: user.id,
            ingredient_id: ing.id,
            quantity_level: "some",
          }))
        );
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  const steps = [
    <SkillStep key="skill" value={skillLevel} onChange={setSkillLevel} />,
    <DietaryStep key="dietary" value={dietary} onChange={setDietary} />,
    <PantryStep key="pantry" value={pantryItems} onChange={setPantryItems} />,
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition ${
                i === step ? "bg-amber-500" : i < step ? "bg-amber-300" : "bg-stone-300"
              }`}
            />
          ))}
        </div>

        {steps[step]}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 border border-stone-300 rounded-lg hover:bg-stone-100 font-medium"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Setting up..." : "Start Cooking!"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
