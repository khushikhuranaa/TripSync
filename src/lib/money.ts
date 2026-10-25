import type { Expense } from "@/lib/types";

/**
 * Money is stored in the database as whole paise (integer minor units) and
 * only converted to rupees at the edges. Converting once and working in
 * integers avoids the rounding drift that floating-point rupees would cause.
 */
export function rupeesToMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function minorToRupees(amount: number): number {
  return Math.round(amount) / 100;
}

/**
 * Split an amount equally, in paise.
 *
 * When an amount does not divide evenly, the first participants in the list
 * each cover one extra paisa. Every share is an integer and the shares always
 * add up exactly to the total.
 *
 * Example: ₹1,000 across 3 people → ₹333.34, ₹333.33, ₹333.33.
 */
export function splitEqually(
  amount: number,
  participantIds: string[],
): Record<string, number> {
  if (participantIds.length === 0) return {};

  const total = rupeesToMinor(amount);
  const base = Math.floor(total / participantIds.length);
  let remainder = total - base * participantIds.length;

  return participantIds.reduce<Record<string, number>>((shares, id) => {
    const minor = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    shares[id] = minorToRupees(minor);
    return shares;
  }, {});
}

/** The same split, expressed exactly in paise for database storage. */
export function splitEquallyMinor(
  totalMinor: number,
  participantIds: string[],
): { userId: string; shareMinor: number }[] {
  if (participantIds.length === 0) return [];
  const base = Math.floor(totalMinor / participantIds.length);
  let remainder = totalMinor - base * participantIds.length;
  return participantIds.map((userId) => {
    const shareMinor = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { userId, shareMinor };
  });
}

/**
 * A custom (unequal) split, in paise.
 *
 * Callers send the rupees each person owes. Converting each share to paise can
 * leave the total a few paise away from the expense amount, so the difference
 * is applied to the largest share: the stored splits always add up exactly to
 * what was spent. A difference larger than one paisa per person is a real
 * mismatch and is rejected before this helper runs.
 */
export function customSplitMinor(
  totalMinor: number,
  sharesRupees: Record<string, number>,
): { userId: string; shareMinor: number }[] {
  const entries = Object.entries(sharesRupees).map(([userId, rupees]) => ({
    userId,
    shareMinor: Math.round(rupees * 100),
  }));
  if (entries.length === 0) return [];

  entries.sort((a, b) => b.shareMinor - a.shareMinor);
  const sum = entries.reduce((total, entry) => total + entry.shareMinor, 0);
  entries[0].shareMinor += totalMinor - sum;
  return entries;
}

/** Group equal shares so the UI can explain a split without hiding rounding. */
export function splitBreakdown(
  amount: number,
  participantIds: string[],
): { amount: number; people: number }[] {
  const shares = Object.values(splitEqually(amount, participantIds));
  const counts = new Map<number, number>();
  for (const share of shares) {
    counts.set(share, (counts.get(share) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([share, people]) => ({ amount: share, people }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MemberBalance {
  memberId: string;
  paid: number;
  share: number;
  /** Positive means the member paid more than their share. */
  balance: number;
}

export interface ExpenseSummary {
  total: number;
  remaining: number | null;
  categoryTotals: { category: string; amount: number }[];
  balances: MemberBalance[];
}

export interface Settlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

/**
 * Suggests the fewest useful transfers that would settle the group.
 *
 * The calculation never changes an expense: it only reads the net balances and
 * moves money from the largest debtor to the largest creditor until everyone is
 * at zero. Amounts are handled in paise, so suggestions always add up exactly.
 */
export function suggestSettlements(balances: MemberBalance[]): Settlement[] {
  const debtors = balances
    .filter((balance) => balance.balance < 0)
    .map((balance) => ({
      id: balance.memberId,
      minor: -rupeesToMinor(balance.balance),
    }))
    .sort((a, b) => b.minor - a.minor);
  const creditors = balances
    .filter((balance) => balance.balance > 0)
    .map((balance) => ({
      id: balance.memberId,
      minor: rupeesToMinor(balance.balance),
    }))
    .sort((a, b) => b.minor - a.minor);

  const transfers: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const minor = Math.min(debtor.minor, creditor.minor);
    if (minor > 0) {
      transfers.push({
        fromMemberId: debtor.id,
        toMemberId: creditor.id,
        amount: minorToRupees(minor),
      });
    }
    debtor.minor -= minor;
    creditor.minor -= minor;
    if (debtor.minor === 0) debtorIndex += 1;
    if (creditor.minor === 0) creditorIndex += 1;
  }
  return transfers;
}

export function summarizeExpenses(
  expenses: Expense[],
  memberIds: string[],
  budget: number | null,
): ExpenseSummary {
  const paid = new Map<string, number>();
  const shares = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  let total = 0;

  for (const expense of expenses) {
    total += expense.amount;
    paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amount);
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount,
    );

    // The splits stored with the expense are authoritative; the equal-split
    // helper is only a fallback for records without split rows.
    const split =
      expense.shares && Object.keys(expense.shares).length > 0
        ? expense.shares
        : splitEqually(expense.amount, expense.participantIds);
    for (const [memberId, share] of Object.entries(split)) {
      shares.set(memberId, (shares.get(memberId) ?? 0) + share);
    }
  }

  // Work in paise for the final totals so repeated fractions cannot drift.
  total = minorToRupees(rupeesToMinor(total));

  return {
    total,
    remaining: budget === null ? null : minorToRupees(rupeesToMinor(budget) - rupeesToMinor(total)),
    categoryTotals: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    balances: memberIds.map((memberId) => {
      const memberPaid = paid.get(memberId) ?? 0;
      const memberShare = shares.get(memberId) ?? 0;
      return {
        memberId,
        paid: memberPaid,
        share: memberShare,
        balance: minorToRupees(rupeesToMinor(memberPaid) - rupeesToMinor(memberShare)),
      };
    }),
  };
}
