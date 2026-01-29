/**
 * Gamification Types - Levels and XP system
 */

export interface UserStats {
  id: string;
  household_id: string;
  current_level: number;
  current_xp: number;
  total_xp: number;
  streak_days: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LevelDefinition {
  level: number;
  name: string;
  nameKey: string; // i18n key
  minXp: number;
  icon: string;
  color: string; // Tailwind class
}

/**
 * Level progression table
 * Each level requires progressively more XP
 */
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  { level: 1, name: 'Iniciante', nameKey: 'gamification.levels.beginner', minXp: 0, icon: '🌱', color: 'text-emerald-400' },
  { level: 2, name: 'Organizador', nameKey: 'gamification.levels.organizer', minXp: 1000, icon: '📊', color: 'text-blue-400' },
  { level: 3, name: 'Poupador', nameKey: 'gamification.levels.saver', minXp: 3000, icon: '🐷', color: 'text-pink-400' },
  { level: 4, name: 'Investidor', nameKey: 'gamification.levels.investor', minXp: 6000, icon: '📈', color: 'text-purple-400' },
  { level: 5, name: 'Mestre da Riqueza', nameKey: 'gamification.levels.master', minXp: 10000, icon: '🏆', color: 'text-yellow-400' },
];

/**
 * XP rewards for different actions
 */
export const XP_REWARDS = {
  TRANSACTION_CREATE: 10,
  TRANSACTION_CONFIRM: 5,
  BUDGET_CREATE: 25,
  STREAK_BONUS: 15, // Per day of streak
  FIRST_OF_DAY: 20, // Bonus for first action of the day
} as const;

/**
 * Get the current level definition based on total XP
 */
export function getLevelFromXp(totalXp: number): LevelDefinition {
  let currentLevel = LEVEL_DEFINITIONS[0];
  for (const level of LEVEL_DEFINITIONS) {
    if (totalXp >= level.minXp) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

/**
 * Get the next level definition (or null if max level)
 */
export function getNextLevel(currentLevel: number): LevelDefinition | null {
  const nextLevelDef = LEVEL_DEFINITIONS.find(l => l.level === currentLevel + 1);
  return nextLevelDef || null;
}

/**
 * Calculate XP needed for next level
 */
export function getXpForNextLevel(totalXp: number): { current: number; needed: number; progress: number } {
  const currentLevel = getLevelFromXp(totalXp);
  const nextLevel = getNextLevel(currentLevel.level);
  
  if (!nextLevel) {
    // Max level reached
    return { current: totalXp, needed: totalXp, progress: 100 };
  }
  
  const xpInCurrentLevel = totalXp - currentLevel.minXp;
  const xpNeededForNextLevel = nextLevel.minXp - currentLevel.minXp;
  const progress = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
  
  return {
    current: xpInCurrentLevel,
    needed: xpNeededForNextLevel,
    progress,
  };
}
