import React, { useState } from 'react';
import {
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  RecurringItem,
  RecurringCycle,
  BudgetPeriod,
  CYCLE_LABELS,
  PERIOD_LABELS,
  normalizeToPeriod,
} from '../utils/gamification';

interface Props {
  type: 'income' | 'expense';
  items: RecurringItem[];
  budgetPeriod: BudgetPeriod;
  onAdd: (item: Omit<RecurringItem, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Rental', 'Business', 'Other'];
const EXPENSE_CATEGORIES = ['Rent / Mortgage', 'Groceries', 'Transport / Gas', 'Utilities', 'Insurance', 'Subscriptions', 'Gym', 'Other'];
const CYCLES: RecurringCycle[] = ['weekly', 'fortnightly', 'monthly', 'yearly'];

export const RecurringSection: React.FC<Props> = ({ type, items, budgetPeriod, onAdd, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [cycle, setCycle] = useState<RecurringCycle>('monthly');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isIncome = type === 'income';
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;


  const periodTotal = items.reduce(
    (sum, item) => sum + normalizeToPeriod(item.amount, item.cycle, budgetPeriod),
    0
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { setError('Enter a valid amount.'); return; }
    if (!name.trim()) { setError('Enter a name.'); return; }
    if (!category) { setError('Select a category.'); return; }
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), amount: val, category, cycle });
      setName(''); setAmount(''); setCategory(''); setCycle('monthly');
      setShowForm(false);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  };

  return (
    <div className={`rounded-2xl border bg-white dark:bg-[#0c0c0f] shadow-sm overflow-hidden transition-all
      ${isIncome ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-rose-200 dark:border-rose-900/40'}`}>

      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`p-2 rounded-xl flex-shrink-0
            ${isIncome
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
            {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isIncome ? 'Base Income' : 'Base Expenses'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {items.length} {items.length === 1 ? 'item' : 'items'} &nbsp;·&nbsp;
              <span className={isIncome ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                {isIncome ? '+' : '-'}${periodTotal.toFixed(2)}/{PERIOD_LABELS[budgetPeriod].toLowerCase()}
              </span>
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 text-zinc-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-5 pb-5 pt-4 space-y-3">

          {/* Item list */}
          {items.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-2">
              No {isIncome ? 'income' : 'expenses'} added yet.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const periodAmount = normalizeToPeriod(item.amount, item.cycle, budgetPeriod);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.category} &nbsp;·&nbsp; ${item.amount.toFixed(2)}/{CYCLE_LABELS[item.cycle].toLowerCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-bold font-mono
                        ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isIncome ? '+' : '-'}${periodAmount.toFixed(2)}/
                        {PERIOD_LABELS[budgetPeriod].toLowerCase().slice(0, 2)}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add form toggle */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border-2 border-dashed transition-all
                ${isIncome
                  ? 'border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                  : 'border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'}`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add {isIncome ? 'Income Source' : 'Recurring Expense'}
            </button>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/30">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    required
                    placeholder={isIncome ? 'e.g. Weekly Salary' : 'e.g. Monthly Rent'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Category</label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">-- Select --</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pay Cycle</label>
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value as RecurringCycle)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {CYCLES.map((c) => <option key={c} value={c}>{CYCLE_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all
                    ${isIncome
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'} disabled:opacity-50`}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); }}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
