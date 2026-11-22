import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  History,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  PlayCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';

export default function HistoryScreen() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.getMyHistory();
        if (res.success) {
          setAttempts(res.attempts || []);
        } else {
          setError('Failed to fetch test history.');
        }
      } catch (err) {
        console.error('History fetch error:', err);
        setError(err.message || 'Error loading past test attempts.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const totalAttempts = attempts.length;
  const bestScore = totalAttempts > 0 ? Math.max(...attempts.map((a) => a.score)) : 0;
  const avgPercentage =
    totalAttempts > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / totalAttempts
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <History className="w-7 h-7 text-indigo-600" />
              Test Attempt History
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Review your past test scores, timestamps, and accuracy progression
            </p>
          </div>

          <Link
            to="/test"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-100 transition-all self-start sm:self-auto"
          >
            <PlayCircle className="w-4 h-4" />
            Take New Test
          </Link>
        </div>

        {/* Quick Summary Cards */}
        {totalAttempts > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Total Tests Given
                </p>
                <p className="text-2xl font-bold text-slate-900">{totalAttempts}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Highest Score
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {bestScore} <span className="text-sm font-normal text-slate-400">/ 10</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Average Percentage
                </p>
                <p className="text-2xl font-bold text-slate-900">{avgPercentage}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Attempts Table / List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm">Loading your attempt history...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 space-y-2">
              <p className="font-semibold text-sm">{error}</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-20 text-center space-y-4 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">No Tests Taken Yet</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                  You haven't completed any online test sessions yet. Start your first 10-question assessment now!
                </p>
              </div>
              <Link
                to="/test"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-all"
              >
                <PlayCircle className="w-4 h-4" />
                Start Test Now
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attempts.map((att, idx) => {
                const dateObj = new Date(att.createdAt);
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = dateObj.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const mins = Math.floor((att.timeSpentSeconds || 0) / 60);
                const secs = (att.timeSpentSeconds || 0) % 60;
                const timeString = `${mins}m ${secs}s`;

                return (
                  <div
                    key={att._id}
                    className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Attempt index, date, status */}
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                        #{attempts.length - idx}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-base text-slate-900">
                            Score: {att.score} / {att.totalQuestions}
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
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
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              Auto-submitted
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formattedDate} at {formattedTime}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Time: {timeString}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick answer stats & Review Link */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {att.correctAnswersCount} correct
                        </span>
                        <span className="text-rose-600 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          {att.incorrectAnswersCount} wrong
                        </span>
                      </div>

                      <Link
                        to={`/result/${att._id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors shrink-0"
                      >
                        Detailed Review
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

