import type { Poll } from "@/lib/types";

export interface PollOptionResult {
  id: string;
  label: string;
  count: number;
  percentage: number;
  voterIds: string[];
}

export interface PollResult {
  totalVotes: number;
  options: PollOptionResult[];
  leadingOptionId: string | null;
}

/**
 * Count votes and derive percentages for display.
 *
 * Percentages are rounded for the label; the vote counts remain the source of
 * truth, so a close poll never hides how many people actually voted.
 */
export function getPollResult(poll: Poll): PollResult {
  const totalVotes = poll.options.reduce(
    (total, option) => total + option.voterIds.length,
    0,
  );

  const options = poll.options.map((option) => ({
    id: option.id,
    label: option.label,
    count: option.voterIds.length,
    voterIds: option.voterIds,
    percentage:
      totalVotes === 0 ? 0 : Math.round((option.voterIds.length / totalVotes) * 100),
  }));

  const leading = [...options].sort((a, b) => b.count - a.count)[0];
  const uniqueLeader =
    leading && options.filter((option) => option.count === leading.count).length === 1
      ? leading.id
      : null;

  return { totalVotes, options, leadingOptionId: uniqueLeader };
}
