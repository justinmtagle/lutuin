import SignupForm from "@/components/auth/signup-form";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Join Project Lutuin</h1>
      <p className="text-stone-500 mb-8">Your AI Filipino Kitchen Companion</p>
      <SignupForm />
      <p className="mt-6 text-stone-500 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
