import { httpClient } from './core/httpClient';
import { API_ENDPOINTS } from './core/apiConfig';

export type LeaderboardPeriod = 'week' | 'month';

export interface LeaderboardEntry {
  rank: number;
  authorId: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  additions: number;
  edits: number;
  checkIns: number;
}

export interface LeaderboardPage {
  period: LeaderboardPeriod;
  startsOn: string;
  endsOnExclusive: string;
  timeZone: string;
  items: LeaderboardEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  me: LeaderboardEntry | null;
}

export function getLeaderboard(params: { period: LeaderboardPeriod; date: string; page: number; pageSize: number }) {
  return httpClient.get<LeaderboardPage>(API_ENDPOINTS.LEADERBOARD, { params, cache: 'no-store' });
}
