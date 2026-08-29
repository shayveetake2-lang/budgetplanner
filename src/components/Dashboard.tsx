import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import {
  UserProfile,
  Transaction,
  ACHIEVEMENTS,
  SHOP_ITEMS,
  getXpNeededForLevel,
  evaluateAchievements
} from '../utils/gamification';
import {
  LogOut,
  Sun,
  Moon,
  Flame,
  Coins,
  PlusCircle,
  Trash2,
  Award,
  Trophy,
  Sparkles,
  DollarSign,
  Settings,
  Shield,
  Lock,
  Sword,
  Crown,
  Gem,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShoppingBag,
  Check,
  TrendingUp,
  TrendingDown,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const Dashboard: React.FC = () => {
  const { currentUser, userProfile, signOut, updateProfile } = useAuth();
  
  // Theme state (independent of user profile for instant toggle, but loaded/saved dynamically)
  const [isDark, setIsDark] = useState(true);

  // Database states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  // Form states
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  // Pagination & Filter states
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Level Up & Achievements Unlocks Modal overlays
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState(1);
  const [unlockedNotification, setUnlockedNotification] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Fetch transactions on load
  useEffect(() => {
    if (currentUser) {
      fetchTransactions();
    }
  }, [currentUser]);

  const fetchTransactions = async () => {
    if (!currentUser) return;
    try {
      setLoadingTxs(true);
      const list = await dataService.getTransactions(currentUser.uid);
      setTransactions(list);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTxs(false);
    }
  };

  // Sync dark class on HTML node
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  if (!userProfile || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#09090b]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-zinc-500">Loading your character profile...</p>
        </div>
      </div>
    );
  }

  // Calculate current month's expenses and income
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(currentYearMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentYearMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  // HP Math: Health represents remaining budget. Max Health = Budget.
  // Damage taken = Expenses. Remaining HP = Budget - Expenses.
  const maxHp = userProfile.monthlyBudget;
  const currentDamage = monthlyExpenses;
  const currentHp = Math.max(0, maxHp - currentDamage);
  const hpPercentage = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;

  // Determine HP bar color and state
  let hpColor = 'bg-emerald-500';
  let hpGlow = 'glow-emerald';
  let hpStatusText = 'Healthy';

  if (hpPercentage <= 20) {
    hpColor = 'bg-rose-500 animate-pulse';
    hpGlow = 'glow-rose border-rose-500 animate-pulse-border';
    hpStatusText = 'CRITICAL (Near Bankruptcy!)';
  } else if (hpPercentage <= 50) {
    hpColor = 'bg-amber-500';
    hpGlow = 'glow-amber border-amber-400';
    hpStatusText = 'Wounded (Budgeting carefully)';
  }

  // XP Progress Math
  const xpNeeded = getXpNeededForLevel(userProfile.level);
  const xpPercentage = (userProfile.xp / xpNeeded) * 100;

  // Define Category lists based on Transaction Type
  const incomeCategories = ['Loot/Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
  const expenseCategories = ['Rations/Food', 'Tavern/Entertainment', 'Mount/Transport', 'Gear/Shopping', 'Inn/Rent', 'Other'];

  // Handle transaction submission
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setFormError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!category) {
      setFormError('Please select a category.');
      return;
    }

    setFormLoading(true);
    try {
      // 1. Write transaction to DB
      const newTx = await dataService.addTransaction(currentUser.uid, {
        type: txType,
        amount: val,
        category,
        description: description.trim(),
        date
      });

      // 2. Refresh local transactions list
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);

      // 3. Compute base XP and coins rewards
      let xpAward = 0;
      let coinAward = 0;

      if (txType === 'income') {
        xpAward = 10;
        coinAward = 5;
      } else {
        // If still under budget
        if (monthlyExpenses + val <= userProfile.monthlyBudget) {
          xpAward = 5;
          coinAward = 2;
        } else {
          // Warning! Overspent! No XP or coins awarded.
          xpAward = 0;
          coinAward = 0;
        }
      }

      let nextXp = userProfile.xp + xpAward;
      let nextLevel = userProfile.level;
      let nextCoins = userProfile.coins + coinAward;
      let leveledUp = false;

      // Handle cumulative levels check
      let currentXpNeeded = getXpNeededForLevel(nextLevel);
      while (nextXp >= currentXpNeeded) {
        nextXp -= currentXpNeeded;
        nextLevel += 1;
        // Award bonus coins on level up
        nextCoins += nextLevel * 50;
        leveledUp = true;
        currentXpNeeded = getXpNeededForLevel(nextLevel);
      }

      // Prepare updated profile mockup for achievements evaluation
      const currentMockProfile: UserProfile = {
        ...userProfile,
        level: nextLevel,
        xp: nextXp,
        coins: nextCoins
      };

      // 4. Evaluate Achievements
      const achEval = evaluateAchievements(currentMockProfile, updatedTxs);
      
      const newAchievementsList = [
        ...userProfile.unlockedAchievements,
        ...achEval.unlockedIds
      ];

      nextXp += achEval.awardedXp;
      nextCoins += achEval.awardedCoins;

      // Recalculate level up in case achievement XP triggers it again!
      currentXpNeeded = getXpNeededForLevel(nextLevel);
      while (nextXp >= currentXpNeeded) {
        nextXp -= currentXpNeeded;
        nextLevel += 1;
        nextCoins += nextLevel * 50;
        leveledUp = true;
        currentXpNeeded = getXpNeededForLevel(nextLevel);
      }

      // 5. Update user profile database record
      await updateProfile({
        level: nextLevel,
        xp: nextXp,
        coins: nextCoins,
        unlockedAchievements: newAchievementsList
      });

      // 6. Trigger celebratory modals
      if (leveledUp) {
        setLeveledUpTo(nextLevel);
        setShowLevelUpModal(true);
        // Fire confetti
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }

      if (achEval.unlockedIds.length > 0) {
        setUnlockedNotification(achEval.unlockedIds);
        // Small confetti pop
        confetti({ particleCount: 50, spread: 50, colors: ['#facc15', '#fbbf24'] });
        setTimeout(() => setUnlockedNotification([]), 5000);
      }

      // Reset form fields
      setAmount('');
      setDescription('');
      setCategory('');
      setFormError(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record transaction.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle transaction deletion
  const handleDeleteTx = async (txId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction? (XP and coins will not be refunded or deducted)')) {
      return;
    }
    try {
      await dataService.deleteTransaction(currentUser.uid, txId);
      // Remove from state
      setTransactions(transactions.filter(t => t.id !== txId));
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  // Update budget limit settings
  const handleUpdateBudgetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(budgetLimitInput);
    if (isNaN(limit) || limit <= 0) {
      alert('Please enter a valid monthly budget limit.');
      return;
    }
    try {
      await updateProfile({ monthlyBudget: limit });
      setShowBudgetSettings(false);
      setBudgetLimitInput('');
    } catch (err) {
      console.error('Failed to update budget limit:', err);
    }
  };

  // Virtual Customization Shop Purchases
  const handlePurchaseItem = async (itemId: string, itemPrice: number, itemType: 'frame' | 'theme') => {
    if (userProfile.coins < itemPrice) {
      alert('Insufficient gold coins! Complete quests and stay under budget to earn more.');
      return;
    }

    try {
      const isAlreadyUnlocked =
        itemType === 'frame'
          ? userProfile.activeAvatarFrame === itemId || userProfile.unlockedAchievements.includes(itemId) // frame locks mapping
          : userProfile.unlockedThemes.includes(itemId);

      if (isAlreadyUnlocked) {
        // Just equip it
        if (itemType === 'frame') {
          await updateProfile({ activeAvatarFrame: itemId });
        } else {
          await updateProfile({ activeTheme: itemId });
        }
        return;
      }

      // Deduct coins & unlock
      const updatedCoins = userProfile.coins - itemPrice;
      if (itemType === 'frame') {
        // For frames, we just set it as active (and mock unlock since we don't have separate frame unlock lists in user profile to keep Firestore lightweight)
        await updateProfile({
          coins: updatedCoins,
          activeAvatarFrame: itemId
        });
      } else {
        const nextThemes = [...userProfile.unlockedThemes, itemId];
        await updateProfile({
          coins: updatedCoins,
          unlockedThemes: nextThemes,
          activeTheme: itemId
        });
      }
      confetti({ particleCount: 30, spread: 40 });
    } catch (err) {
      console.error('Failed to purchase shop item:', err);
    }
  };

  // Map theme background color styles based on activeTheme selection
  const getThemeBackgroundStyles = () => {
    switch (userProfile.activeTheme) {
      case 'theme_emerald':
        return 'bg-emerald-950/20 border-emerald-900/50';
      case 'theme_cyber':
        return 'bg-indigo-950/20 border-indigo-900/50';
      case 'theme_crimson':
        return 'bg-rose-950/20 border-rose-900/50';
      default:
        return 'bg-zinc-50 dark:bg-[#09090b]';
    }
  };

  // Dynamic colors for buttons based on activeTheme selection
  const getThemeAccentColor = () => {
    switch (userProfile.activeTheme) {
      case 'theme_emerald':
        return 'emerald';
      case 'theme_cyber':
        return 'purple';
      case 'theme_crimson':
        return 'rose';
      default:
        return 'blue';
    }
  };

  const getAccentBtnClass = () => {
    const acc = getThemeAccentColor();
    if (acc === 'emerald') return 'bg-emerald-600 hover:bg-emerald-700 text-white';
    if (acc === 'purple') return 'bg-purple-600 hover:bg-purple-700 text-white';
    if (acc === 'rose') return 'bg-rose-600 hover:bg-rose-700 text-white';
    return 'bg-blue-600 hover:bg-blue-700 text-white';
  };

  const getAccentTextClass = () => {
    const acc = getThemeAccentColor();
    if (acc === 'emerald') return 'text-emerald-500 dark:text-emerald-400';
    if (acc === 'purple') return 'text-purple-500 dark:text-purple-400';
    if (acc === 'rose') return 'text-rose-500 dark:text-rose-400';
    return 'text-blue-500 dark:text-blue-400';
  };

  // Map avatar frames styling
  const getAvatarFrameBorder = () => {
    const frame = SHOP_ITEMS.find(item => item.id === userProfile.activeAvatarFrame);
    return frame ? frame.previewColor : 'border-transparent';
  };

  // Filtering transactions logic
  const filteredTransactions = transactions.filter(t => {
    if (txFilter === 'income') return t.type === 'income';
    if (txFilter === 'expense') return t.type === 'expense';
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getLucideIcon = (iconName: string, className: string = 'w-5 h-5') => {
    const props = { className };
    switch (iconName) {
      case 'Sword': return <Sword {...props} />;
      case 'Coins': return <Coins {...props} />;
      case 'Shield': return <Shield {...props} />;
      case 'Lock': return <Lock {...props} />;
      case 'Flame': return <Flame {...props} />;
      case 'Crown': return <Crown {...props} />;
      case 'Gem': return <Gem {...props} />;
      case 'Award': return <Award {...props} />;
      default: return <Trophy {...props} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 pb-12 ${getThemeBackgroundStyles()}`}>
      
      {/* -------------------- DUAL-MODE HEADER -------------------- */}
      <header className="max-w-[1600px] mx-auto p-4 md:p-6 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] shadow-sm rounded-b-xl">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Shield className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              Budget<span className={getAccentTextClass()}>RPG</span>
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              Campaign: {dataService.isFirebase ? 'Cloud Database' : 'Local Archive'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
            title="Toggle Visual Theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Log Out Button */}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 rounded-lg text-sm font-semibold transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* -------------------- HERO STATS BAR ROW -------------------- */}
      <section className="max-w-[1600px] mx-auto px-4 md:px-6 mt-6">
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Avatar frame display */}
          <div className="md:col-span-3 flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 transition-all ${getAvatarFrameBorder()}`}>
              <User className="w-9 h-9 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                {userProfile.username}
                <Crown className="w-4 h-4 text-yellow-500" />
              </h2>
              <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">Class:</span> Adventurer
              </div>
            </div>
          </div>

          {/* Level and XP progress bar */}
          <div className="md:col-span-5 space-y-2">
            <div className="flex justify-between items-end">
              <span className="px-2 py-0.5 text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-900/50">
                LEVEL {userProfile.level}
              </span>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                XP: {userProfile.xp} / {xpNeeded}
              </span>
            </div>
            <div className="w-full h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-300 dark:border-zinc-700">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, xpPercentage)}%` }}
              />
            </div>
          </div>

          {/* Coins Wallet and Streaks */}
          <div className="md:col-span-4 grid grid-cols-2 gap-4">
            {/* Coins */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:scale-[1.02] transition-transform">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Gold Coins</p>
                <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-mono">{userProfile.coins}g</p>
              </div>
            </div>

            {/* Daily Streak */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:scale-[1.02] transition-transform">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-500 flex-shrink-0">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Active Streak</p>
                <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-mono">{userProfile.streak} Days</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* -------------------- MAIN DASHBOARD split grids -------------------- */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BUDGET HEALTH & TRANSACTIONS ACTION (8/12) */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* BUDGET HP / SHIELD HEALTH CARD */}
          <div className={`bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md transition-all ${hpColor.includes('rose') ? 'animate-pulse-border border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Budget Mana (HP) Bar
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Status: <span className="font-bold text-zinc-800 dark:text-zinc-200">{hpStatusText}</span>
                </p>
              </div>
              <button
                onClick={() => setShowBudgetSettings(!showBudgetSettings)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
                title="Adjust Budget Threshold"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* HP Settings toggled panel */}
            {showBudgetSettings && (
              <form onSubmit={handleUpdateBudgetLimit} className="mb-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Set Monthly Budget Limit ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1500"
                    value={budgetLimitInput}
                    onChange={(e) => setBudgetLimitInput(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-bold rounded-lg ${getAccentBtnClass()}`}
                >
                  Save Limit
                </button>
              </form>
            )}

            {/* Health Bar progress */}
            <div className="space-y-2">
              <div className={`w-full h-8 bg-zinc-200 dark:bg-zinc-850 rounded-lg overflow-hidden p-1 border border-zinc-300 dark:border-zinc-700 relative flex items-center ${hpGlow}`}>
                
                {/* Green/Amber/Red fill based on spending */}
                <div
                  className={`h-full rounded-md transition-all duration-700 ${hpColor}`}
                  style={{ width: `${hpPercentage}%` }}
                />

                {/* HP textual overlay */}
                <div className="absolute inset-0 flex justify-between items-center px-4">
                  <span className="text-xs font-black text-outline text-white uppercase tracking-wider flex items-center gap-1">
                    💖 HP: {Math.round(currentHp)} / {maxHp}
                  </span>
                  <span className="text-xs font-black text-outline text-white font-mono">
                    {Math.round(hpPercentage)}% Left
                  </span>
                </div>
              </div>

              {/* Spend Details cards */}
              <div className="grid grid-cols-2 gap-4 text-center mt-2">
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-900/60">
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Spent This Month</p>
                  <p className="text-base font-bold text-rose-500 font-mono">${currentDamage.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-900/60">
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Earned This Month</p>
                  <p className="text-base font-bold text-emerald-500 font-mono">${monthlyIncome.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ADD TRANSACTION QUEST FORM */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Sword className="w-5 h-5 text-blue-500" />
              Add Transaction (Quest)
            </h3>

            {/* Income vs Expense Selection Tabs */}
            <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl mb-4 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setTxType('expense'); setCategory(''); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  txType === 'expense'
                    ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Spend Money (Expense)
              </button>
              <button
                type="button"
                onClick={() => { setTxType('income'); setCategory(''); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  txType === 'income'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Receive Money (Income)
              </button>
            </div>

            {/* Quest form inputs */}
            <form onSubmit={handleAddTransaction} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-400 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                {/* Category selection */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Category</label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">-- Choose Category --</option>
                    {txType === 'income'
                      ? incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                      : expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    }
                  </select>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly Groceries, Freelance Invoice"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500/50 text-white shadow-md active:scale-[0.99] transition-all"
              >
                {formLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <PlusCircle className="w-5 h-5" />
                    Log Transaction Quest (+XP & Gold)
                  </>
                )}
              </button>
            </form>
          </div>

          {/* TRANSACTION HISTORY TABLE CARD */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md overflow-hidden">
            
            {/* Table Toolbar Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50">Transaction History Log</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Review your past budgeting battles</p>
              </div>

              {/* Segmented Filter Control */}
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl flex gap-1 self-stretch sm:self-auto">
                <button
                  onClick={() => { setTxFilter('all'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    txFilter === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => { setTxFilter('income'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    txFilter === 'income'
                      ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Loot
                </button>
                <button
                  onClick={() => { setTxFilter('expense'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    txFilter === 'expense'
                      ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Expenses
                </button>
              </div>
            </div>

            {/* Table layout */}
            <div className="overflow-x-auto">
              {loadingTxs ? (
                <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                  Loading transaction records...
                </div>
              ) : paginatedTransactions.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                  No transaction quests recorded yet. Embark on a budget task above!
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors text-zinc-900 dark:text-zinc-100"
                      >
                        <td className="px-6 py-3.5 font-mono text-xs">{tx.date}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            tx.type === 'income'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
                          }`}>
                            {tx.type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-medium max-w-[200px] truncate" title={tx.description}>
                          {tx.description || <span className="italic text-zinc-400">No details</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold font-mono">
                          <span className={tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>
                            {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                            title="Delete transaction quest log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                <p>Showing Page {currentPage} of {totalPages}</p>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 disabled:opacity-40"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 disabled:opacity-40"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: ACHIEVEMENTS & SHOP REWARDS (4/12) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* ACHIEVEMENTS CARD PANEL */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50 mb-1 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Achievements Log
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Unlock badges and earn XP rewards</p>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = userProfile.unlockedAchievements.includes(ach.id);
                
                // Color rarities mapping
                let rarityClass = 'text-zinc-500 dark:text-zinc-400';
                if (isUnlocked) {
                  if (ach.rarity === 'legendary') rarityClass = 'text-purple-500 bg-purple-500/10 border-purple-500/40 glow-purple';
                  else if (ach.rarity === 'epic') rarityClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/40 glow-amber';
                  else if (ach.rarity === 'rare') rarityClass = 'text-blue-500 bg-blue-500/10 border-blue-500/40 glow-blue';
                  else rarityClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
                }

                return (
                  <div
                    key={ach.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isUnlocked
                        ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        : 'bg-zinc-50 dark:bg-zinc-900/20 border-zinc-150 dark:border-zinc-850 opacity-60 filter grayscale'
                    }`}
                  >
                    <div className={`p-2 rounded-xl flex-shrink-0 border ${rarityClass}`}>
                      {getLucideIcon(ach.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">{ach.title}</h4>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                          ach.rarity === 'legendary' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-600' :
                          ach.rarity === 'epic' ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600' :
                          ach.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-600' :
                          'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {ach.rarity}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">{ach.description}</p>
                      
                      {/* Rewards */}
                      <div className="flex gap-3 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono">
                        <span className="flex items-center gap-0.5 text-blue-500"><Sparkles className="w-3 h-3" />+{ach.xpReward} XP</span>
                        <span className="flex items-center gap-0.5 text-yellow-500"><Coins className="w-3 h-3" />+{ach.coinsReward}g</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VIRTUAL CUSTOMIZATION SHOP CARD */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50 mb-1 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-500" />
              Guild Armory (Shop)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Spend gold to buy custom styles & frame frames</p>

            <div className="space-y-3">
              {SHOP_ITEMS.map((item) => {
                const isFrame = item.type === 'frame';
                const isUnlocked = isFrame
                  ? userProfile.activeAvatarFrame === item.id || item.price === 0
                  : userProfile.unlockedThemes.includes(item.id);
                
                const isEquipped = isFrame
                  ? userProfile.activeAvatarFrame === item.id
                  : userProfile.activeTheme === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 border flex items-center justify-center ${
                        isFrame ? `border-2 ${item.previewColor} rounded-full` : `${item.previewColor}`
                      }`} />
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.type}</p>
                      </div>
                    </div>

                    <div>
                      {isEquipped ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                          <Check className="w-3.5 h-3.5" /> Equipped
                        </span>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handlePurchaseItem(item.id, 0, item.type)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 active:scale-95 transition-all"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchaseItem(item.id, item.price, item.type)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-zinc-950 active:scale-95 transition-all font-mono"
                        >
                          <Coins className="w-3.5 h-3.5" /> {item.price}g
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </section>
      </main>

      {/* -------------------- LEVEL UP CELEBRATION MODAL -------------------- */}
      {showLevelUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/65 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0c0c0f] border-2 border-yellow-500 rounded-3xl p-6 text-center shadow-[0_0_25px_#eab308] relative overflow-hidden">
            
            {/* Celebration backdrop glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />

            <div className="inline-flex p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mb-4 ring-8 ring-yellow-50 dark:ring-yellow-950/10 animate-bounce">
              <Award className="w-12 h-12" />
            </div>

            <h2 className="text-3xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">LEVEL UP!</h2>
            <p className="text-base text-zinc-500 dark:text-zinc-400 mt-1.5">
              Your budget defense training has leveled you up.
            </p>

            <div className="my-6 inline-flex items-center justify-center gap-3">
              <span className="text-lg font-bold text-zinc-400">Level</span>
              <span className="text-4xl font-black text-yellow-500 animate-pulse">{leveledUpTo}</span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl space-y-2 mb-6">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Level Up Rewards unlocked:</p>
              <div className="flex justify-center gap-4 text-sm font-bold font-mono">
                <span className="text-yellow-500 flex items-center gap-1">
                  <Coins className="w-4 h-4" /> +{leveledUpTo * 50}g Coins
                </span>
                <span className="text-blue-500 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> Full Mana HP
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowLevelUpModal(false)}
              className="w-full py-2.5 rounded-xl font-bold bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-zinc-950 dark:text-zinc-50 transition-all border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 shadow-md"
            >
              Continue Quest
            </button>
          </div>
        </div>
      )}

      {/* -------------------- FLOATING ACHIEVEMENT UNLOCKED NOTIFICATION -------------------- */}
      {unlockedNotification.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce max-w-sm bg-white dark:bg-[#0c0c0f] border-2 border-yellow-500 rounded-2xl p-4 shadow-[0_0_15px_#eab308] flex items-start gap-3">
          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-yellow-600 dark:text-yellow-400 tracking-widest block">Achievement Unlocked!</span>
            {unlockedNotification.map((id) => {
              const ach = ACHIEVEMENTS.find(a => a.id === id);
              return (
                <div key={id} className="mt-1">
                  <h4 className="text-sm font-black text-zinc-950 dark:text-zinc-100">{ach?.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">{ach?.description}</p>
                  <p className="text-[10px] font-bold text-yellow-500 mt-1 font-mono">+{ach?.coinsReward}g coins / +{ach?.xpReward} XP</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

