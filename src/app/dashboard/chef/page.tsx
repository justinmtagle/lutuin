"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import ChatInterface from "@/components/chef/chat-interface";

export default function ChefPage() {
  const [pantry, setPantry] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("skill_level")
        .eq("id", user.id)
        .single();

      const { data: pantryData } = await supabase
        .from("user_pantry")
        .select("ingredients(name)")
        .eq("user_id", user.id);

      setSkillLevel(profile?.skill_level ?? "beginner");
      setPantry(
        pantryData?.map((p: Record<string, any>) => p.ingredients.name) ?? []
      );
    }
    load();
  }, [supabase]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <ChatInterface pantry={pantry} skillLevel={skillLevel} />
    </div>
  );
}
