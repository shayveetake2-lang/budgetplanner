import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import {
  UserProfile,
  Transaction,
  RecurringItem,
  BudgetPeriod,
  ACHIEVEMENTS,
  SHOP_ITEMS,
  PERIOD_LABELS,
  getXpNeededForLevel,
  evaluateAchievements,
  normalizeToPeriod,
  getPeriodDateRange,
  getAllowanceSpent,
  ALLOWANCE_COLOR_CLASSES,
} from '../utils/gamification';
import {
  LogOut, Sun, Moon, Flame, Coins, PlusCircle, Trash2, Award, Trophy,
  Sparkles, DollarSign, Settings, Shield, Lock, Sword, Crown, Gem,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingBag,
  Check, TrendingUp, TrendingDown, User, LayoutDashboard, History,
  Star, X, PieChart, Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RecurringSection } from './RecurringSection';
import { AllowanceManager } from './AllowanceManager';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type Tab = 'dashboard' | 'history' | 'achievements' | 'shop';

// ------------------------------------------------------------------
// Icon helper
// ------------------------------------------------------------------
const LIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-5 h-5' }) => {
  const p = { className };
  switch (name) {
    case 'Sword': return <Sword {...p} />;
    case 'Coins': return <Coins {...p} />;
    case 'Shield': return <Shield {...p} />;
    case 'Lock': return <Lock {...p} />;
    case 'Flame': return <Flame {...p} />;
    case 'Crown': return <Crown {...p} />;
    case 'Gem': return <Gem {...p} />;
    case 'Award': return <Award {...p} />;
    default: return <Trophy {...p} />;
  }
};

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
export const Dashboard: React.FC = () => {
  const { currentUser, userProfile, signOut, updateProfile, refreshProfile } = useAuth();

  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  // Transaction form
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Budget settings
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');

  // Pagination & filter
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 8;

  // Modals / notifications
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState(1);
  const [unlockedNotifications, setUnlockedNotifications] = useState<string[]>([]);

  // Dark mode sync
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Fetch transactions
  useEffect(() => {
    if (!currentUser) return;
    setLoadingTxs(true);
    dataService.getTransactions(currentUser.uid).then((list) => {
      setTransactions(list);
      setLoadingTxs(false);
    });
  }, [currentUser]);

  if (!userProfile || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-zinc-400">Loading character profile…</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Derived budget calculations
  // ------------------------------------------------------------------
  const period = userProfile.budgetPeriod || 'monthly';
  const { start: pStart, end: pEnd } = getPeriodDateRange(period);

  const periodTransactionExpenses = transactions
    .filter((t) => t.type === 'expense' && t.date >= pStart && t.date <= pEnd)
    .reduce((s, t) => s + t.amount, 0);

  const periodTransactionIncome = transactions
    .filter((t) => t.type === 'income' && t.date >= pStart && t.date <= pEnd)
    .reduce((s, t) => s + t.amount, 0);

  const recurringExpenseTotal = (userProfile.recurringExpenses || []).reduce(
    (s, r) => s + normalizeToPeriod(r.amount, r.cycle, period), 0
  );

  const recurringIncomeTotal = (userProfile.recurringIncome || []).reduce(
    (s, r) => s + normalizeToPeriod(r.amount, r.cycle, period), 0
  );

  const totalSpend = periodTransactionExpenses + recurringExpenseTotal;
  const budgetLimit = userProfile.budgetLimit || 1000;
  const remainingBudget = Math.max(0, budgetLimit - totalSpend);
  const hpPct = budgetLimit > 0 ? (remainingBudget / budgetLimit) * 100 : 0;

  let hpBarColor = 'bg-gradient-to-r from-emerald-400 to-green-500';
  let hpGlowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.15)] border-emerald-500/20';
  let hpStatusText = 'Healthy ✅';
  if (hpPct <= 20) {
    hpBarColor = 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse';
    hpGlowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.35)] border-rose-500/50 animate-pulse';
    hpStatusText = 'Critical ⚠️';
  } else if (hpPct <= 50) {
    hpBarColor = 'bg-gradient-to-r from-amber-400 to-orange-500';
    hpGlowClass = 'shadow-[0_0_15px_rgba(245,158,11,0.25)] border-amber-500/30';
    hpStatusText = 'Wounded 🟡';
  }

  // XP
  const xpNeeded = getXpNeededForLevel(userProfile.level);
  const xpPct = Math.min(100, (userProfile.xp / xpNeeded) * 100);

  // Categories
  const incomeCategories = ['Loot / Salary', 'Freelance', 'Investment', 'Gift', 'Side Income', 'Other'];
  const expenseCategories = ['Food / Rations', 'Entertainment', 'Transport', 'Shopping / Gear', 'Rent / Inn', 'Health', 'Utilities', 'Other'];

  // Spent Category Breakdown for Active Period
  const categoryBreakdown = expenseCategories.map((cat) => {
    const amt = transactions
      .filter((t) => t.type === 'expense' && t.category === cat && t.date >= pStart && t.date <= pEnd)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      category: cat,
      amount: amt,
      pct: periodTransactionExpenses > 0 ? (amt / periodTransactionExpenses) * 100 : 0
    };
  }).filter(c => c.amount > 0);

  // ------------------------------------------------------------------
  // Period toggle
  // ------------------------------------------------------------------
  const handlePeriodChange = async (p: BudgetPeriod) => {
    await updateProfile({ budgetPeriod: p });
  };

  // ------------------------------------------------------------------
  // Budget limit save
  // ------------------------------------------------------------------
  const handleSaveBudgetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(budgetLimitInput);
    if (isNaN(v) || v <= 0) return;
    await updateProfile({ budgetLimit: v });
    setShowBudgetSettings(false);
    setBudgetLimitInput('');
  };

  // ------------------------------------------------------------------
  // Add transaction
  // ------------------------------------------------------------------
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { setFormError('Enter a valid amount.'); return; }
    if (!category) { setFormError('Select a category.'); return; }

    setFormLoading(true);
    try {
      const newTx = await dataService.addTransaction(currentUser.uid, {
        type: txType, amount: val, category, description: description.trim(), date,
      });
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);

      // XP / coins
      let xpGain = txType === 'income' ? 15 : (totalSpend + val <= budgetLimit ? 10 : 0);
      let coinGain = txType === 'income' ? 10 : (totalSpend + val <= budgetLimit ? 5 : 0);

      let newXp = userProfile.xp + xpGain;
      let newLevel = userProfile.level;
      let newCoins = userProfile.coins + coinGain;
      let leveled = false;

      while (newXp >= getXpNeededForLevel(newLevel)) {
        newXp -= getXpNeededForLevel(newLevel);
        newLevel++;
        newCoins += newLevel * 50;
        leveled = true;
      }

      const mockProfile: UserProfile = { ...userProfile, level: newLevel, xp: newXp, coins: newCoins };
      const achResult = evaluateAchievements(mockProfile, updatedTxs);

      newXp += achResult.awardedXp;
      newCoins += achResult.awardedCoins;
      while (newXp >= getXpNeededForLevel(newLevel)) {
        newXp -= getXpNeededForLevel(newLevel);
        newLevel++;
        newCoins += newLevel * 50;
        leveled = true;
      }

      const newUnlocked = [...(userProfile.unlockedAchievements || []), ...achResult.unlockedIds];
      await updateProfile({ level: newLevel, xp: newXp, coins: newCoins, unlockedAchievements: newUnlocked });

      if (leveled) {
        setLeveledUpTo(newLevel);
        setShowLevelUpModal(true);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
      if (achResult.unlockedIds.length > 0) {
        setUnlockedNotifications(achResult.unlockedIds);
        confetti({ particleCount: 50, spread: 50, colors: ['#facc15', '#fbbf24'] });
        setTimeout(() => setUnlockedNotifications([]), 6000);
      }

      setAmount(''); setDescription(''); setCategory('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save transaction.');
    } finally {
      setFormLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete transaction
  // ------------------------------------------------------------------
  const handleDeleteTx = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await dataService.deleteTransaction(currentUser.uid, id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // ------------------------------------------------------------------
  // Recurring item handlers
  // ------------------------------------------------------------------
  const handleAddRecurring = useCallback(async (
    type: 'income' | 'expense',
    item: Omit<RecurringItem, 'id'>
  ) => {
    const newItem = await dataService.addRecurringItem(currentUser.uid, type, item);
    const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
    await updateProfile({ [key]: [...(userProfile[key] || []), newItem] });
  }, [currentUser.uid, userProfile, updateProfile]);

  const handleDeleteRecurring = useCallback(async (
    type: 'income' | 'expense',
    itemId: string
  ) => {
    await dataService.deleteRecurringItem(currentUser.uid, type, itemId);
    const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
    await updateProfile({ [key]: (userProfile[key] || []).filter((r: RecurringItem) => r.id !== itemId) });
  }, [currentUser.uid, userProfile, updateProfile]);

  // ------------------------------------------------------------------
  // Shop purchase
  // ------------------------------------------------------------------
  const handlePurchase = async (itemId: string, price: number, type: 'frame' | 'theme') => {
    const isUnlocked = type === 'frame'
      ? userProfile.activeAvatarFrame === itemId || price === 0
      : userProfile.unlockedThemes.includes(itemId);

    if (isUnlocked) {
      await updateProfile(type === 'frame' ? { activeAvatarFrame: itemId } : { activeTheme: itemId });
      return;
    }
    if (userProfile.coins < price) { alert('Not enough gold!'); return; }
    const updates: Partial<UserProfile> = { coins: userProfile.coins - price };
    if (type === 'frame') updates.activeAvatarFrame = itemId;
    else { updates.unlockedThemes = [...userProfile.unlockedThemes, itemId]; updates.activeTheme = itemId; }
    await updateProfile(updates);
    confetti({ particleCount: 40, spread: 40 });
  };

  // ------------------------------------------------------------------
  // Filtered / paginated transactions
  // ------------------------------------------------------------------
  const filtered = transactions.filter((t) =>
    txFilter === 'all' ? true : t.type === txFilter
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // ------------------------------------------------------------------
  // Avatar frame style
  // ------------------------------------------------------------------
  const frameCls = SHOP_ITEMS.find((i) => i.id === userProfile.activeAvatarFrame)?.previewColor || 'border-transparent';

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const NavBtn = ({ tab, icon, label }: { tab: Tab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`relative flex flex-col items-center gap-1 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl
        ${activeTab === tab
          ? 'text-violet-500 dark:text-violet-400 bg-violet-100/80 dark:bg-violet-900/30 shadow-md shadow-violet-500/5'
          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/40'}`}
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
      {activeTab === tab && (
        <span className="absolute bottom-1 w-1.5 h-1.5 bg-violet-500 rounded-full sm:hidden" />
      )}
    </button>
  );

  const { start: weekStart, end: weekEnd } = getPeriodDateRange('weekly');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#070708] text-zinc-950 dark:text-zinc-50 transition-colors duration-300 font-sans pb-24 md:pb-8">

      {/* ───── HEADER ───── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0c0c0f]/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35">
              <Shield className="w-5 h-5" />
            </span>
            <span className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
              Budget<span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">RPG</span>
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <NavBtn tab="dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
            <NavBtn tab="history" icon={<History className="w-4 h-4" />} label="History" />
            <NavBtn tab="achievements" icon={<Trophy className="w-4 h-4" />} label="Quests" />
            <NavBtn tab="shop" icon={<ShoppingBag className="w-4 h-4" />} label="Armory" />
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200/50 dark:border-rose-950/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100/80 dark:hover:bg-rose-900/35 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───── HERO STATS BAR (Gamified Character Banner) ───── */}
      <div className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200/80 dark:border-zinc-800/80 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background grid pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-700/5 [mask-image:linear-gradient(0deg,transparent,white)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 items-center">

            {/* Avatar frame container */}
            <div className="flex items-center gap-4 col-span-1 sm:col-span-1">
              <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex-shrink-0 shadow-inner ${frameCls} transition-all duration-300`}>
                <User className="w-7 h-7 text-zinc-400 dark:text-zinc-500" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-base text-zinc-900 dark:text-white truncate">{userProfile.username}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20 mt-1">
                  LVL {userProfile.level}
                </span>
              </div>
            </div>

            {/* XP bar with shimmer effect */}
            <div className="col-span-1 sm:col-span-1 space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold font-mono text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-500" /> XP Progress</span>
                <span>{userProfile.xp} / {xpNeeded}</span>
              </div>
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden relative border border-zinc-200/50 dark:border-zinc-700/30">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out relative"
                  style={{ width: `${xpPct}%` }}
                >
                  {/* Shimmer light element */}
                  <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.25)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                </div>
              </div>
            </div>

            {/* Gold coins */}
            <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/40 dark:border-zinc-800/40 p-3 rounded-2xl">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 shadow-md shadow-amber-500/10 flex-shrink-0 animate-pulse">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Gold Balance</p>
                <p className="text-lg font-black font-mono text-zinc-900 dark:text-amber-400">{userProfile.coins}g</p>
              </div>
            </div>

            {/* Streak */}
            <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/40 dark:border-zinc-800/40 p-3 rounded-2xl">
              <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-500 shadow-md shadow-orange-500/10 flex-shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Daily Streak</p>
                <p className="text-lg font-black font-mono text-zinc-900 dark:text-orange-400">{userProfile.streak} days</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ───── MAIN CONTENT ───── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* ─── DASHBOARD TAB ─── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* 1. Budget HP Card */}
            <div className={`bg-white dark:bg-[#0c0c0f] rounded-3xl border p-6 transition-all duration-300 ${hpGlowClass}`}>

              {/* Title + period toggle + settings */}
              <div className="flex flex-wrap items-start gap-4 justify-between mb-5">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Budget HP Tracker — <span className="text-zinc-500 dark:text-zinc-400 font-bold text-sm">{hpStatusText}</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                    <Info size={11} />
                    Active Window: {pStart} to {pEnd}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Period toggle */}
                  <div className="flex bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60 rounded-xl p-0.5 gap-0.5">
                    {(['weekly', 'monthly', 'yearly'] as BudgetPeriod[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all
                          ${period === p
                            ? 'bg-white dark:bg-zinc-800 text-violet-500 dark:text-violet-400 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                      >
                        {PERIOD_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowBudgetSettings(!showBudgetSettings)}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800/60 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-all"
                    title="Change Budget Limit"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Budget limit settings panel */}
              {showBudgetSettings && (
                <form onSubmit={handleSaveBudgetLimit} className="mb-5 flex flex-col sm:flex-row gap-3 items-end p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/50">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                      Budget Limit per {PERIOD_LABELS[period]} ($)
                    </label>
                    <input
                      type="number"
                      placeholder={`e.g. ${period === 'weekly' ? '500' : period === 'monthly' ? '2000' : '24000'}`}
                      value={budgetLimitInput}
                      onChange={(e) => setBudgetLimitInput(e.target.value)}
                      className="w-full bg-white dark:bg-[#070708] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <button type="submit" className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold rounded-xl bg-violet-500 hover:bg-violet-600 text-white shadow-md shadow-violet-500/25 active:scale-95 transition-all">
                    Save Limit
                  </button>
                </form>
              )}

              {/* HP bar */}
              <div className="space-y-4">
                <div className="w-full h-11 bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative flex items-center border border-zinc-200 dark:border-zinc-700/60 shadow-inner">
                  <div
                    className={`h-full rounded-2xl transition-all duration-700 ${hpBarColor}`}
                    style={{ width: `${hpPct}%` }}
                  />
                  <div className="absolute inset-0 flex justify-between items-center px-4">
                    <span className="text-xs font-black text-white dark:text-white drop-shadow-md">
                      💖 ${remainingBudget.toFixed(0)} left of ${budgetLimit}
                    </span>
                    <span className="text-xs font-black text-white dark:text-white drop-shadow-md font-mono">
                      {Math.round(hpPct)}% HP
                    </span>
                  </div>
                </div>

                {/* 4-stat mini grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Amount Spent', value: `$${periodTransactionExpenses.toFixed(2)}`, color: 'text-rose-500' },
                    { label: 'Base Expenses', value: `$${recurringExpenseTotal.toFixed(2)}`, color: 'text-orange-500' },
                    { label: 'Logged Income', value: `$${periodTransactionIncome.toFixed(2)}`, color: 'text-emerald-500' },
                    { label: 'Base Income', value: `$${recurringIncomeTotal.toFixed(2)}`, color: 'text-violet-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-zinc-50 dark:bg-zinc-900/20 rounded-2xl p-3.5 border border-zinc-200/30 dark:border-zinc-800/40 text-center hover:scale-[1.02] transition-transform">
                      <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
                      <p className={`text-base font-black font-mono ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. DYNAMIC ALLOWANCE SECTIONS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <Star className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                  Active Allowances
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(userProfile.allowances || []).map((allowance) => {
                  const spent = getAllowanceSpent(allowance, transactions, weekStart, weekEnd);
                  const limit = allowance.weeklyBudget;
                  const remaining = Math.max(0, limit - spent);
                  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
                  const colors = ALLOWANCE_COLOR_CLASSES[allowance.color] || ALLOWANCE_COLOR_CLASSES.violet;

                  return (
                    <div
                      key={allowance.id}
                      className={`bg-white dark:bg-[#0c0c0f] rounded-3xl border ${colors.border} shadow-md shadow-zinc-200/20 dark:shadow-none p-5 relative overflow-hidden hover:scale-[1.01] transition-transform duration-200`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-2xl ${colors.bg}`}>
                            {allowance.icon}
                          </span>
                          <div>
                            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">{allowance.name}</h4>
                            <p className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                              Matches: {allowance.matchKeywords.join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-xs font-mono font-bold">
                          <span className={colors.text}>Spent: ${spent.toFixed(2)}</span>
                          <span className="text-zinc-400">Limit: ${limit.toFixed(2)}/wk</span>
                        </div>
                        <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200/50 dark:border-zinc-700/50">
                          <div
                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                              pct >= 100 ? 'from-red-500 to-rose-600 shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                              pct >= 85 ? 'from-amber-400 to-orange-500' :
                              colors.bar
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400 flex items-center justify-between mt-1">
                          <span>
                            {remaining > 0
                              ? `🛡️ $${remaining.toFixed(2)} remaining`
                              : '⚠️ Limit exceeded!'}
                          </span>
                          <span className="font-bold font-mono text-zinc-600 dark:text-zinc-300">{Math.round(pct)}% used</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Allowance Configuration Panel */}
            <AllowanceManager
              uid={currentUser.uid}
              allowances={userProfile.allowances || []}
              onChanged={refreshProfile}
            />

            {/* 4. SPENT BREAKDOWN BREAKOUT */}
            {categoryBreakdown.length > 0 && (
              <div className="bg-white dark:bg-[#0c0c0f] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md shadow-zinc-200/20 dark:shadow-none p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-violet-500" />
                    Spent Breakdown ({PERIOD_LABELS[period]})
                  </h3>
                  <span className="text-xs font-mono font-bold text-rose-500">
                    Total: ${periodTransactionExpenses.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-3">
                  {categoryBreakdown.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">{item.category}</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">
                          ${item.amount.toFixed(2)} <span className="text-zinc-400 font-normal">({Math.round(item.pct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Recurring Base Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <RecurringSection
                type="income"
                items={userProfile.recurringIncome || []}
                budgetPeriod={period}
                onAdd={(item) => handleAddRecurring('income', item)}
                onDelete={(id) => handleDeleteRecurring('income', id)}
              />
              <RecurringSection
                type="expense"
                items={userProfile.recurringExpenses || []}
                budgetPeriod={period}
                onAdd={(item) => handleAddRecurring('expense', item)}
                onDelete={(id) => handleDeleteRecurring('expense', id)}
              />
            </div>

            {/* 6. Add transaction form */}
            <div className="bg-white dark:bg-[#0c0c0f] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md shadow-zinc-200/20 dark:shadow-none p-5">
              <h3 className="text-base font-black text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Sword className="w-4 h-4 text-violet-500" />
                Log a Transaction
              </h3>

              {/* Income / Expense toggle */}
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl mb-4 border border-zinc-200/80 dark:border-zinc-800/60">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTxType(t); setCategory(''); }}
                    className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5
                      ${txType === t
                        ? `bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 ${t === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    {t === 'expense' ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    {t === 'expense' ? 'Spend Money' : 'Receive Money'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                {formError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs rounded-xl">
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Amount ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="number" step="0.01" required placeholder="0.00"
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 dark:bg-[#070708] border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Category</label>
                    <select
                      required value={category} onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-[#070708] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-zinc-950 dark:text-zinc-100"
                    >
                      <option value="">-- Category --</option>
                      {(txType === 'income' ? incomeCategories : expenseCategories).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Description (optional)</label>
                    <input
                      type="text" placeholder="What was it for?"
                      value={description} onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-[#070708] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Date</label>
                    <input
                      type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-[#070708] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <button
                  type="submit" disabled={formLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/60 text-white shadow-lg shadow-violet-500/25 transition-all active:scale-[0.99] border-b-2 border-violet-700"
                >
                  {formLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><PlusCircle className="w-4 h-4" /> Log Transaction (+XP &amp; Gold)</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#0c0c0f] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md shadow-zinc-200/20 dark:shadow-none overflow-hidden">
            {/* Toolbar */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white">Transaction History</h3>
                <p className="text-xs text-zinc-400">{transactions.length} total transactions recorded</p>
              </div>
              <div className="flex bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60 rounded-xl p-0.5 gap-0.5">
                {(['all', 'income', 'expense'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setTxFilter(f); setCurrentPage(1); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize
                      ${txFilter === f
                        ? `bg-white dark:bg-zinc-800 shadow-sm ${f === 'income' ? 'text-emerald-600 dark:text-emerald-400' : f === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    {f === 'all' ? 'All' : f === 'income' ? 'Loot' : 'Expenses'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loadingTxs ? (
                <div className="p-12 text-center text-zinc-500 text-sm">Querying logs…</div>
              ) : paginated.length === 0 ? (
                <div className="p-12 text-center text-zinc-400 text-sm">No transaction records found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 text-[10px] uppercase tracking-wider font-extrabold border-b border-zinc-200 dark:border-zinc-800">
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-left hidden sm:table-cell">Description</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tx) => (
                      <tr key={tx.id} className="border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{tx.date}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${tx.type === 'income'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/10'
                              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-500/10'}`}>
                            {tx.type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300 hidden sm:table-cell max-w-[200px] truncate">
                          {tx.description || <span className="italic text-zinc-500">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold font-mono whitespace-nowrap">
                          <span className={tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>
                            {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1">
                  {[
                    { icon: <ChevronsLeft className="w-4 h-4" />, action: () => setCurrentPage(1), disabled: currentPage === 1 },
                    { icon: <ChevronLeft className="w-4 h-4" />, action: () => setCurrentPage((p) => Math.max(1, p - 1)), disabled: currentPage === 1 },
                    { icon: <ChevronRight className="w-4 h-4" />, action: () => setCurrentPage((p) => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages },
                    { icon: <ChevronsRight className="w-4 h-4" />, action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
                  ].map(({ icon, action, disabled }, i) => (
                    <button key={i} onClick={action} disabled={disabled}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ACHIEVEMENTS TAB ─── */}
        {activeTab === 'achievements' && (
          <div className="bg-white dark:bg-[#0c0c0f] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md shadow-zinc-200/20 dark:shadow-none p-5">
            <h3 className="text-base font-black text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" /> Quests &amp; Achievements
            </h3>
            <p className="text-xs text-zinc-400 mb-4">{userProfile.unlockedAchievements?.length || 0} of {ACHIEVEMENTS.length} completed</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = (userProfile.unlockedAchievements || []).includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200
                      ${unlocked
                        ? 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:scale-[1.01]'
                        : 'bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200/40 dark:border-zinc-900/30 opacity-50 grayscale'}`}
                  >
                    <div className={`p-2.5 rounded-xl border flex-shrink-0
                      ${unlocked
                        ? ach.rarity === 'legendary' ? 'bg-purple-100 dark:bg-purple-950/30 border-purple-400/50 text-purple-600 dark:text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                          : ach.rarity === 'epic' ? 'bg-yellow-100 dark:bg-yellow-950/30 border-yellow-400/50 text-yellow-600 dark:text-yellow-400'
                          : ach.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-950/30 border-blue-400/50 text-blue-600 dark:text-blue-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-400/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>
                      <LIcon name={ach.icon} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">{ach.title}</h4>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full
                          ${ach.rarity === 'legendary' ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                            : ach.rarity === 'epic' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300'
                            : ach.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          {ach.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{ach.description}</p>
                      <div className="flex gap-3 mt-2 text-[10px] font-mono font-bold">
                        <span className="text-violet-500 flex items-center gap-0.5"><Sparkles className="w-3 h-3" />+{ach.xpReward} XP</span>
                        <span className="text-amber-500 flex items-center gap-0.5"><Coins className="w-3 h-3" />+{ach.coinsReward}g</span>
                      </div>
                    </div>
                    {unlocked && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── SHOP TAB ─── */}
        {activeTab === 'shop' && (
          <div className="bg-white dark:bg-[#0c0c0f] rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md shadow-zinc-200/20 dark:shadow-none p-5">
            <h3 className="text-base font-black text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-500" /> Guild Armory
            </h3>
            <p className="text-xs text-zinc-400 mb-4">Spend gold coins to unlock customizations — <span className="font-extrabold text-amber-500">{userProfile.coins}g available</span></p>

            {/* Frames */}
            <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Avatar Frames</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
              {SHOP_ITEMS.filter((i) => i.type === 'frame').map((item) => {
                const equipped = userProfile.activeAvatarFrame === item.id;
                const owned = item.price === 0 || equipped;
                return (
                  <div key={item.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full border-4 bg-zinc-200 dark:bg-zinc-700 flex-shrink-0 ${item.previewColor}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                        {item.price > 0 && !equipped && <p className="text-[10px] text-zinc-500 font-mono">{item.price}g</p>}
                      </div>
                    </div>
                    {equipped ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-900/30 flex-shrink-0">
                        <Check className="w-3 h-3" /> On
                      </span>
                    ) : owned ? (
                      <button onClick={() => handlePurchase(item.id, 0, 'frame')} className="px-3.5 py-1 text-xs font-bold rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all flex-shrink-0 active:scale-95">Equip</button>
                    ) : (
                      <button onClick={() => handlePurchase(item.id, item.price, 'frame')} className="flex items-center gap-1 px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-all flex-shrink-0 font-mono active:scale-95">
                        <Coins className="w-3 h-3" />{item.price}g
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Themes */}
            <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Themes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SHOP_ITEMS.filter((i) => i.type === 'theme').map((item) => {
                const equipped = userProfile.activeTheme === item.id;
                const owned = (userProfile.unlockedThemes || []).includes(item.id) || item.price === 0;
                return (
                  <div key={item.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex-shrink-0 ${item.previewColor}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                        {!owned && <p className="text-[10px] text-zinc-500 font-mono">{item.price}g</p>}
                      </div>
                    </div>
                    {equipped ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-900/30 flex-shrink-0">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : owned ? (
                      <button onClick={() => handlePurchase(item.id, 0, 'theme')} className="px-3.5 py-1 text-xs font-bold rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all flex-shrink-0 active:scale-95">Use</button>
                    ) : (
                      <button onClick={() => handlePurchase(item.id, item.price, 'theme')} className="flex items-center gap-1 px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-all flex-shrink-0 font-mono active:scale-95">
                        <Coins className="w-3 h-3" />{item.price}g
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ───── MOBILE BOTTOM NAV ───── */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden z-30 bg-white/95 dark:bg-[#0c0c0f]/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 flex justify-around pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] px-2 shadow-lg">
        {([
          { tab: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
          { tab: 'history', icon: <History className="w-5 h-5" />, label: 'History' },
          { tab: 'achievements', icon: <Trophy className="w-5 h-5" />, label: 'Quests' },
          { tab: 'shop', icon: <ShoppingBag className="w-5 h-5" />, label: 'Shop' },
        ] as { tab: Tab; icon: React.ReactNode; label: string }[]).map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-200
              ${activeTab === tab
                ? 'text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* ───── LEVEL UP MODAL ───── */}
      {showLevelUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-[#0c0c0f] border-2 border-yellow-500 rounded-3xl p-6 text-center shadow-[0_0_40px_#eab308] relative">
            <button onClick={() => setShowLevelUpModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600">
              <X className="w-5 h-5" />
            </button>
            <div className="inline-flex p-4.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mb-4 animate-bounce">
              <Award className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-zinc-950 dark:text-white">LEVEL UP!</h2>
            <p className="text-zinc-500 mt-1">You reached</p>
            <p className="text-6xl font-black text-yellow-500 my-4">{leveledUpTo}</p>
            <div className="flex justify-center gap-4 text-sm font-bold font-mono mb-6">
              <span className="text-yellow-500 flex items-center gap-1"><Coins className="w-4 h-4" />+{leveledUpTo * 50}g</span>
              <span className="text-violet-500 flex items-center gap-1"><Star className="w-4 h-4" />New Rank!</span>
            </div>
            <button
              onClick={() => setShowLevelUpModal(false)}
              className="w-full py-3.5 rounded-xl font-bold bg-yellow-500 hover:bg-yellow-600 text-zinc-950 transition-all border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1"
            >
              Continue Quest
            </button>
          </div>
        </div>
      )}

      {/* ───── ACHIEVEMENT TOAST ───── */}
      {unlockedNotifications.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 w-80 bg-white dark:bg-[#0c0c0f] border-2 border-yellow-500 rounded-2xl p-4 shadow-[0_0_20px_#eab308] animate-bounce">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex-shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-400">Quest Completed!</p>
              {unlockedNotifications.map((id) => {
                const ach = ACHIEVEMENTS.find((a) => a.id === id);
                return (
                  <div key={id} className="mt-1">
                    <p className="text-sm font-black text-zinc-950 dark:text-white">{ach?.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{ach?.description}</p>
                    <p className="text-[10px] font-bold text-yellow-500 font-mono">+{ach?.xpReward} XP &nbsp; +{ach?.coinsReward}g</p>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setUnlockedNotifications([])} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
