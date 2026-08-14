export type HistoryPresentationEntry = {
  changed: boolean;
  differenceDays: number | null;
};

export function summarizeHistory(history: HistoryPresentationEntry[]) {
  const changedEntries = history.filter((entry) => entry.changed);
  return {
    uploadCount: history.length,
    changeCount: changedEntries.length,
    delayedChangeCount: changedEntries.filter((entry) => (entry.differenceDays || 0) > 0).length,
    advancedChangeCount: changedEntries.filter((entry) => (entry.differenceDays || 0) < 0).length,
  };
}

export function formatChangeSummary(history: HistoryPresentationEntry[]) {
  const summary = summarizeHistory(history);
  if (summary.changeCount === 0) return "Sem alteração registrada";
  return `${summary.changeCount} alteração(ões) em ${summary.uploadCount} upload(s)`;
}
