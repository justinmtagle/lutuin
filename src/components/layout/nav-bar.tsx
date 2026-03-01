"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "\u{1F3E0}" },
  { href: "/dashboard/kusina", label: "Kusina", icon: "\u{1F9C5}" },
  { href: "/dashboard/suggest", label: "Cook", icon: "\u{1F373}" },
  { href: "/dashboard/chef", label: "Chef", icon: "\u{1F468}\u{200D}\u{1F373}" },
];

export default function NavBar({
  level,
  streak,
}: {
  level?: number;
  streak?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:block sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-amber-600"
          >
            Lutuin
          </Link>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${
                  pathname === item.href
                    ? "bg-amber-100 text-amber-700"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {streak !== undefined && streak > 0 && (
              <div className="ml-2 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold flex items-center gap-1">
                {"\u{1F525}"} {streak}
              </div>
            )}
            {level !== undefined && (
              <div className="ml-1 px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg text-sm font-bold flex items-center gap-1">
                {"\u{1F6E1}\u{FE0F}"} {level}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="ml-2 px-3 py-2 text-sm text-stone-400 hover:text-stone-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar (logo + badges only) */}
      <nav className="md:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-amber-100">
        <div className="px-4 h-12 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-amber-600"
          >
            Lutuin
          </Link>
          <div className="flex items-center gap-2">
            {streak !== undefined && streak > 0 && (
              <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1">
                {"\u{1F525}"} {streak}
              </div>
            )}
            {level !== undefined && (
              <div className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-lg text-xs font-bold flex items-center gap-1">
                {"\u{1F6E1}\u{FE0F}"} {level}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-amber-100 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition ${
                pathname === item.href
                  ? "text-amber-600"
                  : "text-stone-400"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
