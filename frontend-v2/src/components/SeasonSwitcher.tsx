'use client';

import { useRouter, useParams, usePathname } from 'next/navigation';
import { useSeasons } from '@/hooks/useSeasons';
import { useSeason } from '@/hooks/useGames';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown } from 'lucide-react';

export default function SeasonSwitcher() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const leagueId = params.leagueId as string;
  const seasonId = params.seasonId as string;

  // Only show on season pages
  const isSeasonPage = pathname.includes('/seasons/') && leagueId && seasonId;

  const {
    data: seasons = [],
    isLoading: seasonsLoading
  } = useSeasons(leagueId);

  const {
    data: currentSeason
  } = useSeason(seasonId);

  // Don't render if not on season page or only one season exists
  if (!isSeasonPage || seasonsLoading || seasons.length <= 1) {
    return null;
  }

  const handleSeasonChange = (newSeasonId: string) => {
    if (newSeasonId !== seasonId) {
      router.push(`/leagues/${leagueId}/seasons/${newSeasonId}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-3 text-sm">
          <Calendar className="h-4 w-4 mr-2" />
          {currentSeason?.name || 'Select Season'}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {seasons.map((season) => (
          <DropdownMenuItem
            key={season.id}
            onClick={() => handleSeasonChange(season.id.toString())}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-1 w-full">
              <span className="font-medium">{season.name}</span>
              {(season.start_date || season.end_date) && (
                <span className="text-xs text-muted-foreground">
                  {season.start_date ? new Date(season.start_date).toLocaleDateString() : 'No start'} -{' '}
                  {season.end_date ? new Date(season.end_date).toLocaleDateString() : 'No end'}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}