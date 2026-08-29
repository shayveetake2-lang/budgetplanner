export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  level: number;
  xp: number; // XP in the current level
  coins: number;
  monthlyBudget: number;
  streak: number;
  lastLoginDate: string; // YYYY-MM-DD
  unlockedAchievements: string[];
  unlockedThemes: string[];
  activeTheme: string;
  activeAvatarFrame: string;
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
  previewColor: string; // hex or Tailwind class
}

// Achievements list
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: 'First Venture',
    description: 'Record your very first transaction (income or expense).',
    xpReward: 50,
    coinsReward: 30,
    icon: 'Sword',
    rarity: 'common'
  },
  {
    id: 'income_earner',
    title: 'Loot Drop',
    description: 'Receive money by recording an income transaction.',
    xpReward: 50,
    coinsReward: 30,
    icon: 'Coins',
    rarity: 'common'
  },
  {
    id: 'penny_pincher',
    title: 'Shield Block',
    description: 'Record an expense without overspending your budget.',
    xpReward: 40,
    coinsReward: 25,
    icon: 'Shield',
    rarity: 'common'
  },
  {
    id: 'strict_saver',
    title: 'Treasure Guardian',
    description: 'Keep monthly spending below 80% of your total budget limit.',
    xpReward: 100,
    coinsReward: 80,
    icon: 'Lock',
    rarity: 'rare'
  },
  {
    id: 'streak_3',
    title: 'Novice Adventurer',
    description: 'Maintain a 3-day active streak of tracking budgets.',
    xpReward: 80,
    coinsReward: 50,
    icon: 'Flame',
    rarity: 'common'
  },
  {
    id: 'streak_7',
    title: 'Elite Knight',
    description: 'Maintain a 7-day budget tracking streak.',
    xpReward: 200,
    coinsReward: 150,
    icon: 'Crown',
    rarity: 'epic'
  },
  {
    id: 'gold_hoarder',
    title: 'Gringotts Heir',
    description: 'Amass 500 gold coins in your wallet.',
    xpReward: 150,
    coinsReward: 100,
    icon: 'Gem',
    rarity: 'epic'
  },
  {
    id: 'level_5_badge',
    title: 'Guild Master',
    description: 'Level up your profile to Level 5.',
    xpReward: 300,
    coinsReward: 200,
    icon: 'Award',
    rarity: 'legendary'
  }
];

// Shop customization catalog
export const SHOP_ITEMS: ShopItem[] = [
  // Avatar Frames
  { id: 'frame_none', name: 'No Frame', type: 'frame', price: 0, previewColor: 'border-transparent' },
  { id: 'frame_bronze', name: 'Bronze Shield', type: 'frame', price: 100, previewColor: 'border-amber-700 ring-2 ring-amber-800' },
  { id: 'frame_silver', name: 'Silver Aegis', type: 'frame', price: 250, previewColor: 'border-slate-300 ring-2 ring-slate-400' },
  { id: 'frame_gold', name: 'Royal Gold', type: 'frame', price: 500, previewColor: 'border-yellow-400 ring-2 ring-yellow-500 shadow-[0_0_8px_#facc15]' },
  { id: 'frame_neon', name: 'Neon Cyber', type: 'frame', price: 800, previewColor: 'border-purple-500 ring-2 ring-pink-500 shadow-[0_0_12px_#d946ef]' },
  
  // Theme Overlays
  { id: 'theme_zinc', name: 'Zinc Dungeon', type: 'theme', price: 0, previewColor: 'bg-zinc-800' },
  { id: 'theme_emerald', name: 'Elven Forest', type: 'theme', price: 200, previewColor: 'bg-emerald-800' },
  { id: 'theme_cyber', name: 'Synthwave Neon', type: 'theme', price: 400, previewColor: 'bg-indigo-900' },
  { id: 'theme_crimson', name: 'Blood Keep', type: 'theme', price: 400, previewColor: 'bg-rose-950' }
];

// Calculate XP required for a given level
export const getXpNeededForLevel = (level: number): number => {
  return level * 150;
};

// Check if adding this transaction unlocks new achievements
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
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        newlyUnlocked.push(id);
        extraXp += ach.xpReward;
        extraCoins += ach.coinsReward;
      }
    }
  };

  // 1. First Venture (1st transaction)
  if (transactions.length > 0) {
    unlock('first_step');
  }

  // 2. Loot Drop (1st Income)
  const hasIncome = transactions.some(t => t.type === 'income');
  if (hasIncome) {
    unlock('income_earner');
  }

  // 3. Shield Block (1st Expense)
  const hasExpense = transactions.some(t => t.type === 'expense');
  if (hasExpense) {
    unlock('penny_pincher');
  }

  // 4. Treasure Guardian (Spending < 80% monthly budget)
  // Calculate this month's spending
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthExpenses = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(currentYearMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  if (thisMonthExpenses > 0 && thisMonthExpenses < profile.monthlyBudget * 0.8) {
    unlock('strict_saver');
  }

  // 5. Streaks check
  if (profile.streak >= 3) {
    unlock('streak_3');
  }
  if (profile.streak >= 7) {
    unlock('streak_7');
  }

  // 6. Gold Hoarder
  if (profile.coins >= 500) {
    unlock('gold_hoarder');
  }

  // 7. Level 5 Badge
  if (profile.level >= 5) {
    unlock('level_5_badge');
  }

  return {
    unlockedIds: newlyUnlocked,
    awardedXp: extraXp,
    awardedCoins: extraCoins
  };
};

