export type PendingAgingRow = {
  orderItemId: number;
  orderCreationDate?: string | null;
  status?: string | null;
};

export type PendingAgingSummary = {
  total: number;
  upTo30: number;
  from31To60: number;
  from61To90: number;
  above90: number;
  withoutCreationDate: number;
};

function parseCreationDate(value: string | null | undefined) {
  if (!value || value === "Sem previsão") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day)
    ? parsed
    : null;
}

/**
 * Consolida itens pendentes únicos por idade desde a Data de criação.
 * Eventos repetidos do mesmo item são contados apenas uma vez no relatório.
 */
export function getPendingAgingSummary(rows: PendingAgingRow[], referenceDate = new Date()): PendingAgingSummary {
  const summary: PendingAgingSummary = {
    total: 0,
    upTo30: 0,
    from31To60: 0,
    from61To90: 0,
    above90: 0,
    withoutCreationDate: 0,
  };
  const uniquePendingItems = new Map<number, PendingAgingRow>();

  rows.forEach((row) => {
    if (row.status && row.status !== "active") return;
    uniquePendingItems.set(row.orderItemId, row);
  });

  const referenceUtc = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  uniquePendingItems.forEach((row) => {
    summary.total += 1;
    const creationDate = parseCreationDate(row.orderCreationDate);
    if (!creationDate) {
      summary.withoutCreationDate += 1;
      return;
    }

    const ageInDays = Math.max(0, Math.floor((referenceUtc - creationDate.getTime()) / 86400000));
    if (ageInDays <= 30) summary.upTo30 += 1;
    else if (ageInDays <= 60) summary.from31To60 += 1;
    else if (ageInDays <= 90) summary.from61To90 += 1;
    else summary.above90 += 1;
  });

  return summary;
}
