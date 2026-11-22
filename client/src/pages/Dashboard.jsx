import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  PlayCircle,
  Clock,
  CheckCircle2,
  HelpCircle,
  Award,
  History,
  TrendingUp,
  ShieldCheck,
  Calendar,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.getMyHistory();
        if (res.success) {
          setHistory(res.attempts || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const totalAttempts = history.length;
  const bestScore = totalAttempts > 0 ? Math.max(...history.map((h) => h.score)) : 0;
  const averagePercentage =
    totalAttempts > 0
      ? Math.round(
          history.reduce((sum, h) => sum + (h.percentage || 0), 0) / totalAttempts
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 p-8 sm:p-10 text-white shadow-xl shadow-indigo-100">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-indigo-100">
              Welcome Back
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hello, {user?.name || 'Student'}! 👋
            </h1>
            <p className="text-indigo-100 text-sm sm:text-base leading-relaxed">
              Ready to test your knowledge? Take the 10-question timed assessment.
              You have 10 minutes to complete the test with automatic submission.
            </p>
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <Link
                to="/test"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-lg shadow-black/10 hover:bg-indigo-50 active:scale-95 transition-all"
              >
                <PlayCircle className="w-5 h-5" />
                Start 10-Question Test
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 border border-white/20 text-white font-semibold text-sm transition-all"
              >
                <History className="w-4 h-4" />
                View Test History
              </Link>
            </div>
          </div>
          {/* Subtle Decorative Background Circles */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          <div className="absolute right-40 top-0 w-48 h-48 rounded-full bg-indigo-400/20 blur-xl pointer-events-none"></div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Attempts
              </p>
              <p className="text-2xl font-bold text-slate-900">{totalAttempts}</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Best Score
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {bestScore} <span className="text-sm font-medium text-slate-400">/ 10</span>
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Average Accuracy
              </p>
              <p className="text-2xl font-bold text-slate-900">{averagePercentage}%</p>
            </div>
          </div>
        </div>

        {/* Two-Column Section: Instructions & Recent Attempts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Test Instructions Card */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              Test Guidelines
            </h2>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center mt-0.5 shrink-0">
                  1
                </div>
                <span><strong>10 Questions:</strong> Multiple choice questions loaded dynamically from the database.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center mt-0.5 shrink-0">
                  2
                </div>
                <span><strong>10 Minutes Timer:</strong> Live countdown timer. When the timer hits 0:00, your test will auto-submit.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center mt-0.5 shrink-0">
                  3
                </div>
                <span><strong>Instant Scoring & Review:</strong> Get your score breakdown, see right vs. wrong answers, and read explanations.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center mt-0.5 shrink-0">
                  4
                </div>
                <span><strong>Attempt Tracking:</strong> Every test attempt is saved with score, accuracy, and timestamp in your history.</span>
              </li>
            </ul>

            <div className="pt-2">
              <Link
                to="/test"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition-all"
              >
                <PlayCircle className="w-4 h-4" />
                Launch Online Test
              </Link>
            </div>
          </div>

          {/* Recent Attempts Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Recent Test Attempts
                </h2>
                <Link
                  to="/history"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                >
                  View All ({totalAttempts})
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs">Loading past attempts...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <HelpCircle className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No test attempts yet!</p>
                  <p className="text-xs text-slate-400">
                    Click "Launch Online Test" above to take your first test.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.slice(0, 4).map((att) => (
                    <div
                      key={att._id}
                      className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            Score: {att.score} / {att.totalQuestions}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              att.percentage >= 70
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : att.percentage >= 50
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {att.percentage}%
                          </span>
                          {att.status === 'timed_out' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Auto-submitted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(att.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <Link
                        to={`/result/${att._id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-xs font-semibold text-slate-600 transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Admin Privileges Active</p>
                    <p className="text-[11px] text-amber-700">
                      Manage, add, and reset test questions from the Question Bank.
                    </p>
                  </div>
                </div>
                <Link
                  to="/admin"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  Go to Admin
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
