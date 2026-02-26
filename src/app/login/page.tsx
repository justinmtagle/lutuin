import LoginForm from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Welcome Back</h1>
      <p className="text-stone-500 mb-8">Sign in to your kitchen</p>
      <LoginForm />
      <p className="mt-6 text-stone-500 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-amber-600 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
