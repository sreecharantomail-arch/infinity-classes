import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  History,
  LayoutDashboard,
  Check,
  X,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function ResultScreen() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'correct', 'incorrect', 'unattempted'

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await api.getAttemptDetails(id);
        if (res.success && res.attempt) {
          setAttempt(res.attempt);

          // Trigger celebratory confetti if score >= 70%
          if (res.attempt.percentage >= 70) {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 },
            });
          }
        } else {
          setError('Could not retrieve result details.');
        }
      } catch (err) {
        console.error('Error loading result:', err);
        setError(err.message || 'Failed to load test results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-slate-800">Calculating Your Score...</h2>
        <p className="text-sm text-slate-500">Evaluating your answers and preparing review report</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Result Not Found</h2>
          <p className="text-sm text-slate-600">{error || 'Unable to display test results.'}</p>
          <Link
            to="/dashboard"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Filter questions for detailed view
  const filteredAnswers = attempt.answers.filter((item) => {
    if (filter === 'correct') return item.isCorrect;
    if (filter === 'incorrect')
      return !item.isCorrect && item.selectedOptionIndex !== null;
    if (filter === 'unattempted') return item.selectedOptionIndex === null;
    return true;
  });

  const minutesSpent = Math.floor(attempt.timeSpentSeconds / 60);
  const secondsSpent = attempt.timeSpentSeconds % 60;
  const timeFormatted = `${minutesSpent}m ${secondsSpent}s`;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Score Overview Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 sm:p-10 text-white shadow-xl shadow-indigo-200/50">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Assessment Report
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {attempt.percentage >= 80
                  ? 'Outstanding Performance! 🌟'
                  : attempt.percentage >= 60
                  ? 'Good Job! 👍'
                  : 'Keep Practicing! 💪'}
              </h1>
              <p className="text-indigo-200 text-sm max-w-lg leading-relaxed">
                You scored <strong className="text-white">{attempt.score}</strong> out of{' '}
                <strong className="text-white">{attempt.totalQuestions}</strong> questions{' '}
                ({attempt.percentage}%). Review the question-by-question breakdown below to inspect your correct and wrong answers.
              </p>

              {attempt.status === 'timed_out' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Test was auto-submitted because the 10-minute countdown expired.
                </div>
              )}
            </div>

            {/* Score Ring / Pill */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 min-w-[200px] text-center shrink-0">
              <span className="text-xs uppercase tracking-wider text-indigo-200 font-semibold mb-1">
                Final Score
              </span>
              <div className="text-5xl font-black text-white tracking-tight">
                {attempt.score}
                <span className="text-2xl font-bold text-indigo-300">
                  /{attempt.totalQuestions}
                </span>
              </div>
              <div className="mt-2 px-3 py-0.5 rounded-full bg-indigo-500/30 text-white font-bold text-sm">
                {attempt.percentage}% Accuracy
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Correct
              </p>
              <p className="text-xl font-bold text-emerald-600">
                {attempt.correctAnswersCount}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Incorrect
              </p>
              <p className="text-xl font-bold text-rose-600">
                {attempt.incorrectAnswersCount}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Skipped
              </p>
              <p className="text-xl font-bold text-slate-700">
                {attempt.unattemptedCount}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Time Spent
              </p>
              <p className="text-xl font-bold text-slate-900">{timeFormatted}</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Questions ({attempt.answers.length})
            </button>
            <button
              onClick={() => setFilter('correct')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'correct'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Correct ({attempt.correctAnswersCount})
            </button>
            <button
              onClick={() => setFilter('incorrect')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'incorrect'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Incorrect ({attempt.incorrectAnswersCount})
            </button>
            <button
              onClick={() => setFilter('unattempted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'unattempted'
                  ? 'bg-slate-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Skipped ({attempt.unattemptedCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/test"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake Test
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Past Attempts
            </Link>
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="space-y-6">
          {filteredAnswers.map((item, index) => {
            const hasChosen = item.selectedOptionIndex !== null;

            return (
              <div
                key={item.questionId || index}
                className={`p-6 sm:p-7 rounded-2xl bg-white border shadow-sm transition-all ${
                  item.isCorrect
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : hasChosen
                    ? 'border-rose-200 hover:border-rose-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Header: Question Number & Status Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    Question {index + 1}
                  </span>

                  {item.isCorrect ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Correct (+1)
                    </span>
                  ) : hasChosen ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs">
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                      Incorrect
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium text-xs">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Unattempted
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <h3 className="py-4 text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                  {item.questionText}
                </h3>

                {/* 4 Options with Right vs Wrong Indicators */}
                <div className="space-y-2.5 pt-1">
                  {item.options.map((opt, optIdx) => {
                    const isCorrectAnswer = optIdx === item.correctOptionIndex;
                    const isUserChoice = optIdx === item.selectedOptionIndex;
                    const optionLabel = ['A', 'B', 'C', 'D'][optIdx];

                    let optionStyle =
                      'border-slate-200 bg-slate-50/50 text-slate-700';
                    let badge = null;

                    if (isCorrectAnswer) {
                      optionStyle =
                        'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                      badge = (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Correct Answer
                        </span>
                      );
                    } else if (isUserChoice && !item.isCorrect) {
                      optionStyle =
                        'border-rose-400 bg-rose-50/80 text-rose-950 font-medium ring-1 ring-rose-400';
                      badge = (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shrink-0 flex items-center gap-1">
                          <X className="w-3 h-3 stroke-[3]" />
                          Your Answer
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 ${optionStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCorrectAnswer
                                ? 'bg-emerald-600 text-white'
                                : isUserChoice
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {optionLabel}
                          </div>
                          <span>{opt}</span>
                        </div>
                        {badge}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Card */}
                {item.explanation && (
                  <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs sm:text-sm text-indigo-950">
                    <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-indigo-900 block mb-0.5">
                        Explanation:
                      </strong>
                      <p className="leading-relaxed text-indigo-900/90">
                        {item.explanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
