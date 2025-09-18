/**
 * Calculate the current NFL week based on the date
 * NFL season typically starts in early September and runs 18 weeks
 */

export function getCurrentNFLWeek(): number {
  const now = new Date();
  const currentYear = now.getFullYear();

  // NFL season start dates (Week 1 typically starts first Thursday of September)
  // 2024: September 5th, 2025: September 4th
  let seasonStartDay = 5; // Default September 5th
  if (currentYear === 2025) {
    seasonStartDay = 4; // September 4th, 2025
  }

  const seasonStart = new Date(currentYear, 8, seasonStartDay); // September (month is 0-indexed)

  // If we're before the season start, we're in preseason or previous season
  if (now < seasonStart) {
    return 1; // Default to week 1
  }

  // Calculate days since season start
  const daysSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));

  // Each NFL week is 7 days, starting Tuesday and ending Monday
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;

  // NFL regular season is 18 weeks, then playoffs
  return Math.min(weekNumber, 18);
}

export function getNFLWeekDateRange(week: number, year?: number): { start: Date; end: Date } {
  const currentYear = year || new Date().getFullYear();

  // Use same logic as getCurrentNFLWeek
  let seasonStartDay = 5; // Default September 5th
  if (currentYear === 2025) {
    seasonStartDay = 4; // September 4th, 2025
  }

  const seasonStart = new Date(currentYear, 8, seasonStartDay);

  // Calculate week start (Tuesday)
  const weekStart = new Date(seasonStart);
  weekStart.setDate(seasonStart.getDate() + (week - 1) * 7);

  // Week ends on Monday (6 days later)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

export function isGameInCurrentWeek(gameDate: string): boolean {
  const currentWeek = getCurrentNFLWeek();
  const { start } = getNFLWeekDateRange(currentWeek);
  const { end: nextWeekEnd } = getNFLWeekDateRange(currentWeek + 1);
  const game = new Date(gameDate);

  // Show games from current week and next week
  return game >= start && game <= nextWeekEnd;
}