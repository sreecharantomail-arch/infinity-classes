import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function Timer({
  targetEndTime,
  durationSeconds = 600,
  onTimeUp,
  isSubmitted = false,
}) {
  // If targetEndTime is passed (epoch ms), use that; otherwise calculate from durationSeconds
  const [timeLeft, setTimeLeft] = useState(() => {
    if (targetEndTime) {
      return Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
    }
    return durationSeconds;
  });

  useEffect(() => {
    if (isSubmitted) return;

    const calculateRemaining = () => {
      if (targetEndTime) {
        return Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
      }
      return timeLeft;
    };

    const initialRemaining = calculateRemaining();
    if (initialRemaining <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      const remaining = targetEndTime
        ? Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))
        : timeLeft - 1;

      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (onTimeUp) onTimeUp();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetEndTime, isSubmitted, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLowTime = timeLeft <= 120; // 2 minutes or less
  const isCritical = timeLeft <= 60; // 1 minute or less

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all duration-300 ${
        isCritical
          ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse font-bold'
          : isLowTime
          ? 'bg-amber-50 text-amber-700 border-amber-300 font-semibold'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
      }`}
    >
      {isCritical ? (
        <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
      ) : (
        <Clock className="w-4 h-4 text-current" />
      )}
      <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
        Time Left:
      </span>
      <span className="font-mono text-base font-bold tabular-nums">
        {formattedTime}
      </span>
    </div>
  );
}
