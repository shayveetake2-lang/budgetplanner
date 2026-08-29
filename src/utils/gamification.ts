export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';
export type RecurringCycle = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  cycle: RecurringCycle;
}

/**
 * Dynamic allowance — user can add/edit/remove any number.
 * Spend is auto-matched by checking which transactions categories
 * contain any keyword from `matchKeywords` (case-insensitive).
 */
export interface Allowance {
  id: string;
  name: string;
  icon: string; // emoji
  weeklyBudget: number;
  matchKeywords: string[]; // e.g. ['transport', 'gas', 'travel']
  color: 'sky' | 'amber' | 'violet' | 'emerald' | 'rose' | 'orange' | 'pink' | 'teal';
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  level: number;
  xp: number;
  coins: number;
  budgetPeriod: BudgetPeriod;
  budgetLimit: number;
  /** @deprecated use budgetLimit */
  monthlyBudget?: number;
  streak: number;
  lastLoginDate: string;
  unlockedAchievements: string[];
  unlockedThemes: string[];
  activeTheme: string;
  activeAvatarFrame: string;
  recurringExpenses: RecurringItem[];
  recurringIncome: RecurringItem[];
  allowances: Allowance[];
  /** @deprecated use allowances array */
  weeklyTravelAllowance?: number;
  /** @deprecated use allowances array */
  weeklyFoodAllowance?: number;
  targetSavings?: number;
  customIncomeOverride?: number;
  customExpenseOverride?: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  coinsReward: number;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface ShopItem {
  id: string;
  name: string;
  type: 'frame' | 'theme';
  price: number;
  previewColor: string;
}

// ------------------------------------------------------------------
// Default Allowances
// ------------------------------------------------------------------
export const DEFAULT_ALLOWANCES: Allowance[] = [
  {
    id: 'allw_travel',
    name: 'Travel & Transport',
    icon: '🚗',
    weeklyBudget: 100,
    matchKeywords: ['transport', 'gas', 'travel', 'fuel', 'transit', 'uber', 'taxi'],
    color: 'sky',
  },
  {
    id: 'allw_food',
    name: 'Food & Dining',
    icon: '🍔',
    weeklyBudget: 200,
    matchKeywords: ['food', 'rations', 'groceries', 'dining', 'restaurant', 'coffee', 'lunch'],
    color: 'amber',
  },
];

export const ALLOWANCE_COLORS: Allowance['color'][] = ['sky', 'amber', 'violet', 'emerald', 'rose', 'orange', 'pink', 'teal'];

export const ALLOWANCE_COLOR_CLASSES: Record<Allowance['color'], { border: string; text: string; bg: string; bar: string; badge: string }> = {
  sky:     { border: 'border-sky-200 dark:border-sky-800/50',     text: 'text-sky-600 dark:text-sky-400',     bg: 'bg-sky-100 dark:bg-sky-950/50',     bar: 'from-sky-400 to-blue-500',        badge: 'bg-sky-500' },
  amber:   { border: 'border-amber-200 dark:border-amber-800/50', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50', bar: 'from-amber-400 to-orange-500',    badge: 'bg-amber-500' },
  violet:  { border: 'border-violet-200 dark:border-violet-800/50',text: 'text-violet-600 dark:text-violet-400',bg: 'bg-violet-100 dark:bg-violet-950/50',bar: 'from-violet-400 to-purple-500', badge: 'bg-violet-500' },
  emerald: { border: 'border-emerald-200 dark:border-emerald-800/50',text: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-100 dark:bg-emerald-950/50',bar: 'from-emerald-400 to-green-500', badge: 'bg-emerald-500' },
  rose:    { border: 'border-rose-200 dark:border-rose-800/50',   text: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-100 dark:bg-rose-950/50',   bar: 'from-rose-400 to-pink-500',       badge: 'bg-rose-500' },
  orange:  { border: 'border-orange-200 dark:border-orange-800/50',text: 'text-orange-600 dark:text-orange-400',bg: 'bg-orange-100 dark:bg-orange-950/50',bar: 'from-orange-400 to-red-500',     badge: 'bg-orange-500' },
  pink:    { border: 'border-pink-200 dark:border-pink-800/50',   text: 'text-pink-600 dark:text-pink-400',   bg: 'bg-pink-100 dark:bg-pink-950/50',   bar: 'from-pink-400 to-rose-500',       badge: 'bg-pink-500' },
  teal:    { border: 'border-teal-200 dark:border-teal-800/50',   text: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-100 dark:bg-teal-950/50',   bar: 'from-teal-400 to-cyan-500',       badge: 'bg-teal-500' },
};

// ------------------------------------------------------------------
// Period helpers
// ------------------------------------------------------------------

/** Multipliers to convert any cycle → yearly amount */
const CYCLE_TO_YEARLY: Record<RecurringCycle, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  yearly: 1,
};

/** Multipliers to convert yearly → target period */
const YEARLY_TO_PERIOD: Record<BudgetPeriod, number> = {
  weekly: 1 / 52,
  monthly: 1 / 12,
  yearly: 1,
};

/**
 * Converts a recurring item's amount to the active budget period.
 * e.g. $1200/month rent → $276.92/week
 */
export const normalizeToPeriod = (
  amount: number,
  fromCycle: RecurringCycle,
  toPeriod: BudgetPeriod
): number => {
  const yearlyAmount = amount * CYCLE_TO_YEARLY[fromCycle];
  return yearlyAmount * YEARLY_TO_PERIOD[toPeriod];
};

/** Label helpers */
export const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: 'Week',
  monthly: 'Month',
  yearly: 'Year',
};

export const CYCLE_LABELS: Record<RecurringCycle, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/**
 * Get the date range [start, end] (inclusive) for a given budget period,
 * anchored to today.
 */
export const getPeriodDateRange = (period: BudgetPeriod): { start: string; end: string } => {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === 'weekly') {
    // Monday → Sunday
    const day = now.getDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  }

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
};

// ------------------------------------------------------------------
// Allowance spending calculator
// ------------------------------------------------------------------

/**
 * Computes how much has been spent against an allowance this week.
 * Matches by checking if the transaction category contains any keyword.
 */
export const getAllowanceSpent = (
  allowance: Allowance,
  transactions: Transaction[],
  weekStart: string,
  weekEnd: string
): number =>
  transactions
    .filter((t) => {
      if (t.type !== 'expense') return false;
      if (t.date < weekStart || t.date > weekEnd) return false;
      const cat = t.category.toLowerCase();
      const desc = t.description.toLowerCase();
      return allowance.matchKeywords.some((k) => cat.includes(k.toLowerCase()) || desc.includes(k.toLowerCase()));
    })
    .reduce((s, t) => s + t.amount, 0);

// ------------------------------------------------------------------
// Achievements
// ------------------------------------------------------------------

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: 'First Venture',
    description: 'Record your very first transaction.',
    xpReward: 50,
    coinsReward: 30,
    icon: 'Sword',
    rarity: 'common',
  },
  {
    id: 'income_earner',
    title: 'Loot Drop',
    description: 'Record your first income transaction.',
    xpReward: 50,
    coinsReward: 30,
    icon: 'Coins',
    rarity: 'common',
  },
  {
    id: 'penny_pincher',
    title: 'Shield Block',
    description: 'Record an expense without overspending.',
    xpReward: 40,
    coinsReward: 25,
    icon: 'Shield',
    rarity: 'common',
  },
  {
    id: 'strict_saver',
    title: 'Treasure Guardian',
    description: 'Keep period spending below 80% of your budget limit.',
    xpReward: 100,
    coinsReward: 80,
    icon: 'Lock',
    rarity: 'rare',
  },
  {
    id: 'streak_3',
    title: 'Novice Adventurer',
    description: 'Maintain a 3-day active streak.',
    xpReward: 80,
    coinsReward: 50,
    icon: 'Flame',
    rarity: 'common',
  },
  {
    id: 'streak_7',
    title: 'Elite Knight',
    description: 'Maintain a 7-day budget tracking streak.',
    xpReward: 200,
    coinsReward: 150,
    icon: 'Crown',
    rarity: 'epic',
  },
  {
    id: 'gold_hoarder',
    title: 'Gringotts Heir',
    description: 'Amass 500 gold coins.',
    xpReward: 150,
    coinsReward: 100,
    icon: 'Gem',
    rarity: 'epic',
  },
  {
    id: 'level_5_badge',
    title: 'Guild Master',
    description: 'Reach Level 5.',
    xpReward: 300,
    coinsReward: 200,
    icon: 'Award',
    rarity: 'legendary',
  },
];

// ------------------------------------------------------------------
// Shop
// ------------------------------------------------------------------

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'frame_none', name: 'No Frame', type: 'frame', price: 0, previewColor: 'border-transparent' },
  { id: 'frame_bronze', name: 'Bronze Shield', type: 'frame', price: 100, previewColor: 'border-amber-700 ring-2 ring-amber-800' },
  { id: 'frame_silver', name: 'Silver Aegis', type: 'frame', price: 250, previewColor: 'border-slate-300 ring-2 ring-slate-400' },
  { id: 'frame_gold', name: 'Royal Gold', type: 'frame', price: 500, previewColor: 'border-yellow-400 ring-2 ring-yellow-500 shadow-[0_0_8px_#facc15]' },
  { id: 'frame_neon', name: 'Neon Cyber', type: 'frame', price: 800, previewColor: 'border-purple-500 ring-2 ring-pink-500 shadow-[0_0_12px_#d946ef]' },
  { id: 'theme_zinc', name: 'Zinc Dungeon', type: 'theme', price: 0, previewColor: 'bg-zinc-800' },
  { id: 'theme_emerald', name: 'Elven Forest', type: 'theme', price: 200, previewColor: 'bg-emerald-800' },
  { id: 'theme_cyber', name: 'Synthwave Neon', type: 'theme', price: 400, previewColor: 'bg-indigo-900' },
  { id: 'theme_crimson', name: 'Blood Keep', type: 'theme', price: 400, previewColor: 'bg-rose-950' },
];

// ------------------------------------------------------------------
// XP helpers
// ------------------------------------------------------------------

export const getXpNeededForLevel = (level: number): number => level * 150;

// ------------------------------------------------------------------
// Achievement evaluation
// ------------------------------------------------------------------

export const evaluateAchievements = (
  profile: UserProfile,
  transactions: Transaction[]
): { unlockedIds: string[]; awardedXp: number; awardedCoins: number } => {
  const currentUnlocked = new Set(profile.unlockedAchievements);
  const newlyUnlocked: string[] = [];
  let extraXp = 0;
  let extraCoins = 0;

  const unlock = (id: string) => {
    if (!currentUnlocked.has(id)) {
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      if (ach) {
        newlyUnlocked.push(id);
        extraXp += ach.xpReward;
        extraCoins += ach.coinsReward;
      }
    }
  };

  if (transactions.length > 0) unlock('first_step');
  if (transactions.some((t) => t.type === 'income')) unlock('income_earner');
  if (transactions.some((t) => t.type === 'expense')) unlock('penny_pincher');

  // Period-aware budget check
  const { start, end } = getPeriodDateRange(profile.budgetPeriod);
  const periodExpenses = transactions
    .filter((t) => t.type === 'expense' && t.date >= start && t.date <= end)
    .reduce((s, t) => s + t.amount, 0);
  const recurringTotal = (profile.recurringExpenses || []).reduce(
    (s, r) => s + normalizeToPeriod(r.amount, r.cycle, profile.budgetPeriod),
    0
  );
  const totalSpend = periodExpenses + recurringTotal;
  if (totalSpend > 0 && totalSpend < profile.budgetLimit * 0.8) unlock('strict_saver');

  if (profile.streak >= 3) unlock('streak_3');
  if (profile.streak >= 7) unlock('streak_7');
  if (profile.coins >= 500) unlock('gold_hoarder');
  if (profile.level >= 5) unlock('level_5_badge');

  return { unlockedIds: newlyUnlocked, awardedXp: extraXp, awardedCoins: extraCoins };
};
