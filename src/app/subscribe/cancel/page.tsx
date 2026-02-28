import Link from "next/link";

export default function SubscribeCancel() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🤔</div>
        <h1 className="text-2xl font-bold text-stone-800">
          Changed your mind?
        </h1>
        <p className="text-stone-500">
          No worries! You can upgrade anytime from your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-4 bg-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-300 transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
