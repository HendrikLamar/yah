export type BudgetPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type PeriodBounds = {
  start: Date;
  end: Date;
};

export function periodBoundsForDate(period: BudgetPeriod, date: Date): PeriodBounds {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (period === "MONTHLY") {
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
    };
  }

  if (period === "QUARTERLY") {
    const qStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(Date.UTC(year, qStartMonth, 1)),
      end: new Date(Date.UTC(year, qStartMonth + 3, 0, 23, 59, 59, 999)),
    };
  }

  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

export function previousPeriod(period: BudgetPeriod, current: PeriodBounds): PeriodBounds {
  const prevAnchor = new Date(current.start.getTime() - 1);
  return periodBoundsForDate(period, prevAnchor);
}

export function nextPeriod(period: BudgetPeriod, current: PeriodBounds): PeriodBounds {
  const nextAnchor = new Date(current.end.getTime() + 1);
  return periodBoundsForDate(period, nextAnchor);
}

export function isWithin(date: Date, bounds: PeriodBounds): boolean {
  return date >= bounds.start && date <= bounds.end;
}
