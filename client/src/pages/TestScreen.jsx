import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Timer from '../components/Timer';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  RotateCcw,
  Send,
  AlertCircle,
  GraduationCap,
  Clock,
  CheckCircle,
} from 'lucide-react';

const SESSION_STORAGE_KEY = 'online_test_active_session';
const TEST_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export default function TestScreen() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [targetEndTime, setTargetEndTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [autoSubmitNotice, setAutoSubmitNotice] = useState(false);

  const isSubmittingRef = useRef(false);
  const navigate = useNavigate();

  // Helper to persist current session to storage
  const saveSession = useCallback((qList, answers, marked, endMs, startMs) => {
    try {
      const payload = {
        questions: qList,
        selectedAnswers: answers,
        markedForReview: Array.from(marked),
        targetEndTime: endMs,
        startTime: startMs,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to cache test session in localStorage', e);
    }
  }, []);

  // Submit test handler
  const performSubmit = useCallback(
    async (isTimedOut = false) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setSubmitting(true);

      const actualStart = startTime || Date.now();
      const elapsedSeconds = Math.round((Date.now() - actualStart) / 1000);
      const timeSpentSeconds = Math.min(Math.max(1, elapsedSeconds), 600); // capped at 10 minutes

      // Format answers payload
      const answersPayload = questions.map((q) => ({
        questionId: q._id,
        selectedOptionIndex:
          selectedAnswers[q._id] !== undefined ? selectedAnswers[q._id] : null,
      }));

      try {
        const res = await api.submitTest({
          answers: answersPayload,
          timeSpentSeconds,
          isTimedOut,
        });

        // Clear active session upon successful submission
        localStorage.removeItem(SESSION_STORAGE_KEY);

        if (res.success && res.attemptId) {
          navigate(`/result/${res.attemptId}`, { replace: true });
        } else {
          throw new Error(res.message || 'Submission failed.');
        }
      } catch (err) {
        console.error('Submission error:', err);
        setError(err.message || 'Error submitting test. Please try again.');
        isSubmittingRef.current = false;
        setSubmitting(false);
      }
    },
    [questions, selectedAnswers, startTime, navigate]
  );

  // Auto-submit when timer expires
  const handleTimeUp = useCallback(() => {
    setAutoSubmitNotice(true);
    performSubmit(true);
  }, [performSubmit]);

  // Load or resume test session on mount
  useEffect(() => {
    const initializeTest = async () => {
      try {
        // 1. Check if an active session already exists in localStorage
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const now = Date.now();

            // Check if saved session is still within the 10-minute window
            if (parsed.targetEndTime && parsed.questions?.length > 0) {
              if (parsed.targetEndTime <= now) {
                // Session expired while user was away! Auto-submit directly
                setQuestions(parsed.questions);
                setSelectedAnswers(parsed.selectedAnswers || {});
                setStartTime(parsed.startTime || now - TEST_DURATION_MS);
                setAutoSubmitNotice(true);
                setLoading(false);
                // Perform submission with cached answers
                isSubmittingRef.current = true;
                const expiredAnswers = parsed.questions.map((q) => ({
                  questionId: q._id,
                  selectedOptionIndex:
                    parsed.selectedAnswers && parsed.selectedAnswers[q._id] !== undefined
                      ? parsed.selectedAnswers[q._id]
                      : null,
                }));
                const res = await api.submitTest({
                  answers: expiredAnswers,
                  timeSpentSeconds: 600,
                  isTimedOut: true,
                });
                localStorage.removeItem(SESSION_STORAGE_KEY);
                if (res.success && res.attemptId) {
                  navigate(`/result/${res.attemptId}`, { replace: true });
                }
                return;
              } else {
                // Resume ongoing test session with persistent countdown & selections
                setQuestions(parsed.questions);
                setSelectedAnswers(parsed.selectedAnswers || {});
                setMarkedForReview(new Set(parsed.markedForReview || []));
                setTargetEndTime(parsed.targetEndTime);
                setStartTime(parsed.startTime || now);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Corrupted saved session, re-initializing...', e);
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }

        // 2. Otherwise start a fresh test session
        const res = await api.getTestQuestions();
        if (res.success && res.questions?.length > 0) {
          const now = Date.now();
          const calculatedEnd = now + TEST_DURATION_MS;

          setQuestions(res.questions);
          setStartTime(now);
          setTargetEndTime(calculatedEnd);
          saveSession(res.questions, {}, new Set(), calculatedEnd, now);
        } else {
          setError('No questions available in the question bank.');
        }
      } catch (err) {
        console.error('Failed to initialize test:', err);
        setError(err.message || 'Failed to load test questions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeTest();
  }, [saveSession, navigate]);

  const currentQuestion = questions[currentIndex];
  const isAnswered = currentQuestion && selectedAnswers[currentQuestion._id] !== undefined;
  const isMarked = currentQuestion && markedForReview.has(currentQuestion._id);

  const handleSelectOption = (optionIndex) => {
    if (!currentQuestion) return;
    const updatedAnswers = {
      ...selectedAnswers,
      [currentQuestion._id]: optionIndex,
    };
    setSelectedAnswers(updatedAnswers);
    saveSession(questions, updatedAnswers, markedForReview, targetEndTime, startTime);
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const updatedAnswers = { ...selectedAnswers };
    delete updatedAnswers[currentQuestion._id];
    setSelectedAnswers(updatedAnswers);
    saveSession(questions, updatedAnswers, markedForReview, targetEndTime, startTime);
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    const nextMarked = new Set(markedForReview);
    if (nextMarked.has(currentQuestion._id)) {
      nextMarked.delete(currentQuestion._id);
    } else {
      nextMarked.add(currentQuestion._id);
    }
    setMarkedForReview(nextMarked);
    saveSession(questions, selectedAnswers, nextMarked, targetEndTime, startTime);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const markedCount = markedForReview.size;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-slate-800">Preparing Your Test Paper...</h2>
        <p className="text-sm text-slate-500 mt-1">Loading 10 questions from the database</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Unable to Start Test</h2>
          <p className="text-sm text-slate-600">{error || 'No questions available.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Test Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Online Assessment
              </h1>
              <p className="text-xs text-slate-400">10 Questions • Multiple Choice</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 10-Minute Countdown Timer using epoch end timestamp */}
            {targetEndTime && (
              <Timer
                targetEndTime={targetEndTime}
                onTimeUp={handleTimeUp}
                isSubmitted={submitting}
              />
            )}

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={submitting}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Submit Test
            </button>
          </div>
        </div>
      </header>

      {/* Auto Submit Notification Banner */}
      {autoSubmitNotice && (
        <div className="bg-rose-600 text-white text-center py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 animate-pulse">
          <Clock className="w-4 h-4" />
          Time expired! Submitting your test automatically. Please wait...
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Area (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
          <div>
            {/* Question Top Info */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-xs">
                  {currentQuestion.category}
                </span>
              </div>

              {isMarked && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Flag className="w-3.5 h-3.5" />
                  Marked for Review
                </span>
              )}
            </div>

            {/* Question Text */}
            <div className="py-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                {currentQuestion.questionText}
              </h2>
            </div>

            {/* 4 Multiple Choice Options */}
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedAnswers[currentQuestion._id] === idx;
                const optionLabel = ['A', 'B', 'C', 'D'][idx];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left p-4 rounded-xl border text-sm sm:text-base font-medium flex items-center gap-3.5 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/30 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {optionLabel}
                    </div>
                    <span className="flex-1 leading-snug">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Action Controls */}
          <div className="pt-8 mt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  isMarked
                    ? 'border-amber-300 bg-amber-100 text-amber-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {isMarked ? 'Unmark Review' : 'Mark for Review'}
              </button>

              {isAnswered && (
                <button
                  type="button"
                  onClick={handleClearResponse}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((prev) =>
                      Math.min(questions.length - 1, prev + 1)
                    )
                  }
                  className="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-all"
                >
                  <Send className="w-4 h-4" />
                  Finish & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question Palette Sidebar (1 Col) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Question Palette
            </h3>

            {/* Matrix 1-10 */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const answered = selectedAnswers[q._id] !== undefined;
                const marked = markedForReview.has(q._id);
                const isCurrent = currentIndex === idx;

                let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                if (answered && marked) {
                  btnClass = 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300';
                } else if (answered) {
                  btnClass = 'bg-emerald-600 text-white shadow-sm';
                } else if (marked) {
                  btnClass = 'bg-amber-100 text-amber-800 border border-amber-300';
                }

                return (
                  <button
                    key={q._id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative h-10 rounded-xl font-bold text-sm transition-all flex items-center justify-center ${btnClass} ${
                      isCurrent
                        ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105'
                        : ''
                    }`}
                  >
                    {idx + 1}
                    {marked && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-white"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 shrink-0"></span>
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 shrink-0"></span>
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-400 shrink-0"></span>
                <span>Marked for Review ({markedCount})</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Submit Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Submit Your Test?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to finalize and submit your test?
              </p>
            </div>

            {/* Summary statistics */}
            <div className="grid grid-cols-3 gap-2 py-3 px-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div>
                <p className="text-xs text-slate-400 font-medium">Answered</p>
                <p className="text-lg font-bold text-emerald-600">{answeredCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Unanswered</p>
                <p className="text-lg font-bold text-slate-500">{unansweredCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Review</p>
                <p className="text-lg font-bold text-amber-600">{markedCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Review More
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  performSubmit(false);
                }}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Yes, Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
