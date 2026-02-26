"use client";

import { useState, useEffect, useRef } from "react";

export default function StepTimer({ minutes }: { minutes: number }) {
  const [seconds, setSeconds] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, seconds]);

  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      alert("Timer done!");
    }
  }, [seconds, running]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-3 bg-stone-100 px-4 py-2 rounded-lg">
      <span className="text-2xl font-mono font-bold text-stone-800">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      <button
        onClick={() => setRunning(!running)}
        className="px-4 py-1 bg-amber-500 text-white rounded-full text-sm"
      >
        {running ? "Pause" : "Start"}
      </button>
      <button
        onClick={() => {
          setRunning(false);
          setSeconds(minutes * 60);
        }}
        className="px-3 py-1 border border-stone-300 rounded-full text-sm"
      >
        Reset
      </button>
    </div>
  );
}
