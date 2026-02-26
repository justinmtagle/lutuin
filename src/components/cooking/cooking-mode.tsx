"use client";

import { useState } from "react";

type Step = {
  step: number;
  instruction: string;
  tip?: string | null;
  timer_minutes?: number;
};

export default function CookingMode({
  recipeName,
  steps,
  onComplete,
}: {
  recipeName: string;
  steps: Step[];
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6">
      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between text-sm text-stone-400 mb-2">
          <span>{recipeName}</span>
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <div className="w-full bg-stone-700 rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-lg text-center space-y-6">
        <p className="text-2xl md:text-3xl font-medium leading-relaxed">
          {step.instruction}
        </p>

        {step.tip && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-6 py-4">
            <p className="text-amber-300 text-sm">Chef Luto&apos;s tip: {step.tip}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mt-12">
        {currentStep > 0 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-8 py-4 border border-stone-600 rounded-xl text-stone-300 hover:bg-stone-800"
          >
            Previous
          </button>
        )}
        {isLast ? (
          <button
            onClick={onComplete}
            className="px-8 py-4 bg-green-600 rounded-xl text-white hover:bg-green-700 font-semibold"
          >
            Done Cooking!
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="px-8 py-4 bg-amber-600 rounded-xl text-white hover:bg-amber-700 font-semibold"
          >
            Next Step
          </button>
        )}
      </div>
    </div>
  );
}
