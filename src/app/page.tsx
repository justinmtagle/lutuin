import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-amber-700">Lutuin</span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-stone-600 hover:text-stone-800"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-stone-800 leading-tight">
          Your AI Filipino
          <br />
          <span className="text-amber-600">Kitchen Companion</span>
        </h1>
        <p className="mt-6 text-xl text-stone-500 max-w-2xl mx-auto">
          Tell us what&apos;s in your kusina. Chef Luto will suggest delicious
          Filipino dishes you can cook right now &mdash; personalized to your skill
          level and taste.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-10 px-8 py-4 bg-amber-600 text-white rounded-xl text-lg font-semibold hover:bg-amber-700 shadow-lg"
        >
          Start Cooking
        </Link>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-4xl mb-3">&#x1F372;</div>
          <h3 className="font-semibold text-stone-800 mb-2">Stock Your Kusina</h3>
          <p className="text-sm text-stone-500">
            Add your ingredients. We&apos;ll remember what you usually have.
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-3">&#x1F916;</div>
          <h3 className="font-semibold text-stone-800 mb-2">Chat with Chef Luto</h3>
          <p className="text-sm text-stone-500">
            Get personalized suggestions and plan your meal together.
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-3">&#x1F468;&#x200D;&#x1F373;</div>
          <h3 className="font-semibold text-stone-800 mb-2">Cook Step-by-Step</h3>
          <p className="text-sm text-stone-500">
            Follow guided instructions with tips from your AI chef.
          </p>
        </div>
      </section>
    </main>
  );
}
