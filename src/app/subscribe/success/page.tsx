import Link from "next/link";

export default function SubscribeSuccess() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-stone-800">
          Welcome to Premium!
        </h1>
        <p className="text-stone-500">
          Your subscription is now active. Enjoy unlimited Chef Luto and advanced AI features.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
