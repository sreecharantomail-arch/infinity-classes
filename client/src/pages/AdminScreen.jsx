import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  ShieldCheck,
  PlusCircle,
  Trash2,
  RotateCcw,
  BookOpen,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function AdminScreen() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states for adding question
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [category, setCategory] = useState('Computer Science & Web Development');
  const [difficulty, setDifficulty] = useState('medium');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.getAllQuestions();
      if (res.success) {
        setQuestions(res.questions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load question bank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validation
    if (!questionText.trim()) {
      setError('Please provide a question statement.');
      return;
    }

    if (options.some((opt) => !opt.trim())) {
      setError('Please fill in all 4 multiple choice options.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createQuestion({
        questionText: questionText.trim(),
        options: options.map((opt) => opt.trim()),
        correctOptionIndex: parseInt(correctOptionIndex, 10),
        category: category.trim(),
        difficulty,
        explanation: explanation.trim(),
      });

      if (res.success) {
        setSuccessMsg('New question added to database successfully!');
        // Reset form
        setQuestionText('');
        setOptions(['', '', '', '']);
        setCorrectOptionIndex(0);
        setExplanation('');
        fetchQuestions();
      }
    } catch (err) {
      setError(err.message || 'Error creating question.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await api.deleteQuestion(id);
      if (res.success) {
        setSuccessMsg('Question deleted successfully.');
        fetchQuestions();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete question.');
    }
  };

  const handleResetSeed = async () => {
    if (
      !window.confirm(
        'Reset question bank to default 15 questions? Any custom questions will be overwritten.'
      )
    )
      return;

    try {
      setLoading(true);
      const res = await api.resetQuestions();
      if (res.success) {
        setSuccessMsg(res.message || 'Question bank reset successfully.');
        fetchQuestions();
      }
    } catch (err) {
      setError(err.message || 'Failed to reset question bank.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Bonus Feature
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Admin Question Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Add new multiple choice questions to the test bank or manage existing ones
            </p>
          </div>

          <button
            onClick={handleResetSeed}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore 15 Defaults
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <Check className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Question Form (1 Col) */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5 self-start">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Add New Question
            </h2>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Question Text *
                </label>
                <textarea
                  required
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. Which lifecycle hook is executed after component mounts?"
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                />
              </div>

              {/* 4 Options with Radio to select correct one */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  4 Options & Correct Answer *
                </label>
                <p className="text-[11px] text-slate-400">
                  Select the radio button next to the option that is correct.
                </p>

                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      id={`opt-${idx}`}
                      checked={correctOptionIndex === idx}
                      onChange={() => setCorrectOptionIndex(idx)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`opt-${idx}`}
                      className="w-6 text-xs font-bold text-slate-500 uppercase cursor-pointer"
                    >
                      {['A', 'B', 'C', 'D'][idx]}
                    </label>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${['A', 'B', 'C', 'D'][idx]}`}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                        correctOptionIndex === idx
                          ? 'border-emerald-500 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50 focus:bg-white'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category / Subject
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. React & Frontend"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Explanation / Solution Note
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the chosen option is correct..."
                  className="w-full p-3 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Save to Question Bank</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Question Bank Table / List (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Current Question Bank ({questions.length})
                </h2>
                <span className="text-xs text-slate-400">
                  Each test randomly draws 10 from this bank
                </span>
              </div>

              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs">Loading questions...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <HelpCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No questions found.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Restore 15 Defaults" above to load initial questions.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 space-y-4 pt-2">
                  {questions.map((q, idx) => (
                    <div key={q._id} className="pt-4 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-snug">
                              {q.questionText}
                            </p>
                            <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {q.category} • {q.difficulty}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(q._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Options preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 pt-1 text-xs">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border flex items-center gap-2 ${
                              optIdx === q.correctOptionIndex
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                                : 'border-slate-100 bg-slate-50 text-slate-600'
                            }`}
                          >
                            <span className="font-bold text-[10px]">
                              {['A', 'B', 'C', 'D'][optIdx]}:
                            </span>
                            <span className="truncate">{opt}</span>
                            {optIdx === q.correctOptionIndex && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

