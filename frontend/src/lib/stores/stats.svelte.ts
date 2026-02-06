// Statistics tracking store using Svelte 5 Runes

class StatsStore {
  total = $state(0);
  delivered = $state(0);
  deduped = $state(0);
  startTime = $state(Date.now());
  
  // Derived state - events per minute calculation
  eventsPerMin = $derived.by(() => {
    const elapsed = (Date.now() - this.startTime) / 60000;
    return elapsed > 0 ? (this.total / elapsed).toFixed(1) : '0.0';
  });
  
  incrementTotal() {
    this.total++;
    this.delivered++;
  }
  
  incrementDeduped() {
    this.total++;
    this.deduped++;
  }
  
  updateFromState(stats: { total?: number; delivered?: number; deduped?: number }) {
    if (stats.total !== undefined) this.total = stats.total;
    if (stats.delivered !== undefined) this.delivered = stats.delivered;
    if (stats.deduped !== undefined) this.deduped = stats.deduped;
  }
  
  reset() {
    this.total = 0;
    this.delivered = 0;
    this.deduped = 0;
    this.startTime = Date.now();
  }
}

export const statsStore = new StatsStore();
