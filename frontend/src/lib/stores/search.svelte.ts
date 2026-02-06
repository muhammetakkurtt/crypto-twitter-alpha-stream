const STORAGE_KEY = 'crypto-twitter-search-history';
const MAX_HISTORY_ITEMS = 10;

class SearchStore {
  query = $state<string>('');
  history = $state<string[]>([]);
  isActive = $state<boolean>(false);
  
  constructor() {
    this.loadFromStorage();
  }
  
  setQuery(query: string) {
    this.query = query;
  }
  
  addToHistory(query: string) {
    if (!query.trim()) return;
    
    const trimmedQuery = query.trim();
    this.history = [
      trimmedQuery,
      ...this.history.filter(h => h !== trimmedQuery)
    ].slice(0, MAX_HISTORY_ITEMS);
    
    this.saveToStorage();
  }
  
  clearHistory() {
    this.history = [];
    this.saveToStorage();
  }
  
  removeFromHistory(query: string) {
    this.history = this.history.filter(h => h !== query);
    this.saveToStorage();
  }
  
  setActive(active: boolean) {
    this.isActive = active;
  }
  
  clear() {
    this.query = '';
  }
  
  private saveToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    }
  }
  
  private loadFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this.history = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to load search history from storage:', e);
        }
      }
    }
  }
}

export const searchStore = new SearchStore();
