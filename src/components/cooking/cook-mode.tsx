"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Step = {
  number: number;
  title: string;
  instruction: string;
  tip?: string | null;
};

export default function CookMode({
  recipeName,
  steps,
  onComplete,
}: {
  recipeName: string;
  steps: Step[];
  onComplete: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    async function request() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* not critical */
      }
    }
    request();
    return () => {
      wakeLock?.release();
    };
  }, []);

  // Auto-scroll active step into view
  useEffect(() => {
    stepRefs.current[activeStep]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeStep]);

  const handleNext = useCallback(() => {
    setCompletedSteps((prev) => new Set(prev).add(activeStep));
    if (activeStep === steps.length - 1) {
      onComplete();
    } else {
      setActiveStep(activeStep + 1);
    }
  }, [activeStep, steps.length, onComplete]);

  const handlePrevious = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <div
      className="flex flex-col bg-stone-50"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* Sticky header with progress */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto mb-2">
          <h1 className="text-sm font-semibold text-stone-800 truncate mr-4">
            {recipeName}
          </h1>
          <span className="text-xs text-stone-500 whitespace-nowrap">
            Step {activeStep + 1} of {steps.length}
          </span>
        </div>
        <div className="max-w-2xl mx-auto w-full bg-stone-200 rounded-full h-1.5">
          <div
            className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={activeStep + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={`Step ${activeStep + 1} of ${steps.length}`}
          />
        </div>
      </div>

      {/* Scrollable step list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = completedSteps.has(index);

            return (
              <div
                key={step.number}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "step" : undefined}
                onClick={() => setActiveStep(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveStep(index);
                  }
                }}
                className={`rounded-xl p-4 transition-all cursor-pointer ${
                  isActive
                    ? "border-2 border-amber-400 bg-amber-50 opacity-100"
                    : isCompleted
                      ? "border border-stone-200 bg-stone-50 opacity-60"
                      : "border border-stone-200 bg-white opacity-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Number circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isActive
                        ? "bg-amber-500 text-white"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-stone-300 text-white"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-semibold ${
                        isActive ? "text-sm text-stone-900" : "text-sm text-stone-700"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`mt-1 text-stone-600 ml-0 ${
                        isActive ? "text-base" : "text-sm"
                      }`}
                    >
                      {step.instruction}
                    </p>

                    {/* Chef tip — only on active step */}
                    {isActive && step.tip && (
                      <div className="mt-3 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-sm text-amber-800">
                          <span className="font-medium">
                            Chef Luto&apos;s tip:
                          </span>{" "}
                          {step.tip}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-white border-t border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={activeStep === 0}
            className={`px-6 py-3 border border-stone-300 rounded-xl text-stone-600 font-medium transition-opacity ${
              activeStep === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-stone-50"
            }`}
          >
            Previous
          </button>

          {activeStep === steps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
            >
              Done Cooking!
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold"
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
