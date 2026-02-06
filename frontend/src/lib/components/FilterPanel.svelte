<script lang="ts">
  import { filtersStore } from '$lib/stores/filters.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';
  import type { EventType } from '$lib/types';
  
  let keywordInput = $state('');
  let validationError = $state('');
  
  const keywords = $derived(filtersStore.keywords);
  const eventTypes = $derived(filtersStore.eventTypes);
  
  const allEventTypes: Array<{ value: EventType; label: string }> = [
    { value: 'post_created', label: 'Tweet Created' },
    { value: 'post_updated', label: 'Tweet Updated' },
    { value: 'profile_updated', label: 'Profile Updated' },
    { value: 'profile_pinned', label: 'Profile Pinned' },
    { value: 'follow_created', label: 'Follow Created' },
    { value: 'follow_updated', label: 'Follow Updated' },
    { value: 'user_updated', label: 'User Updated' }
  ];
  
  function handleKeywordInput(event: Event) {
    const target = event.target as HTMLInputElement;
    keywordInput = target.value;
    validationError = '';
  }
  
  function validateKeywords(input: string): boolean {
    if (!input.trim()) {
      return true;
    }
    
    const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    for (const keyword of keywords) {
      if (keyword.length < 2) {
        validationError = 'Keywords must be at least 2 characters long';
        return false;
      }
      if (keyword.length > 50) {
        validationError = 'Keywords must be less than 50 characters';
        return false;
      }
    }
    
    return true;
  }
  
  function applyFilters() {
    try {
      if (!validateKeywords(keywordInput)) {
        toastStore.error(validationError);
        return;
      }
      
      const newKeywords = keywordInput
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      filtersStore.setKeywords(newKeywords);
      validationError = '';
      
      if (newKeywords.length > 0) {
        toastStore.success(`Applied ${newKeywords.length} keyword filter${newKeywords.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to apply filters';
      toastStore.error(errorMsg);
      console.error('Filter error:', error);
    }
  }
  
  function clearFilters() {
    try {
      filtersStore.clearAll();
      keywordInput = '';
      validationError = '';
      toastStore.info('All filters cleared');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to clear filters';
      toastStore.error(errorMsg);
      console.error('Clear filters error:', error);
    }
  }
  
  function toggleEventType(eventType: EventType) {
    filtersStore.toggleEventType(eventType);
  }
  
  function isEventTypeChecked(eventType: EventType): boolean {
    return eventTypes.includes(eventType);
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  }
</script>

<div class="filter-panel" role="region" aria-label="Event filters">
  <div class="panel-header">
    <h2 class="panel-title">Filters</h2>
    <button
      class="clear-button"
      onclick={clearFilters}
      aria-label="Clear all filters"
    >
      Clear All
    </button>
  </div>
  
  <form class="filter-form" onsubmit={(e) => { e.preventDefault(); applyFilters(); }}>
    <!-- Keyword Input -->
    <div class="filter-section">
      <label for="keyword-input" class="filter-label">
        Keywords
        <span class="filter-hint">(comma-separated)</span>
      </label>
      <input
        id="keyword-input"
        type="text"
        class="keyword-input"
        class:error={validationError}
        placeholder="bitcoin, ethereum, crypto..."
        value={keywordInput}
        oninput={handleKeywordInput}
        onkeydown={handleKeydown}
        aria-describedby={validationError ? 'keyword-error' : undefined}
      />
      {#if validationError}
        <p id="keyword-error" class="error-message" role="alert">
          {validationError}
        </p>
      {/if}
      {#if keywords.length > 0}
        <div class="keyword-tags">
          {#each keywords as keyword}
            <span class="keyword-tag">{keyword}</span>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- Event Type Checkboxes -->
    <fieldset class="filter-section">
      <legend class="filter-label">Event Types</legend>
      <div class="checkbox-group">
        {#each allEventTypes as { value, label }}
          <label class="checkbox-label">
            <input
              type="checkbox"
              class="checkbox-input"
              checked={isEventTypeChecked(value)}
              onchange={() => toggleEventType(value)}
              aria-label={`Filter ${label}`}
            />
            <span class="checkbox-text">{label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    
    <!-- Apply Button -->
    <button
      type="submit"
      class="apply-button"
      aria-label="Apply keyword filters"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Apply Filters
    </button>
  </form>
</div>

<style>
  .filter-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid #334155;
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
  }
  
  .filter-panel:hover {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  /* Form Layout */
  .filter-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  /* Panel Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }
  
  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #60a5fa;
    margin: 0;
  }
  
  .clear-button {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .clear-button:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    transform: translateY(-1px);
  }
  
  .clear-button:active {
    transform: translateY(0);
  }
  
  .clear-button:focus {
    outline: 3px solid #ef4444;
    outline-offset: 2px;
  }
  
  /* Filter Section */
  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: none;
    padding: 0;
    margin: 0;
  }
  
  /* Fieldset reset - browser defaults override */
  fieldset.filter-section {
    min-inline-size: auto;
    margin-block-start: 0;
    margin-block-end: 0;
    margin-inline-start: 0;
    margin-inline-end: 0;
    padding-block-start: 0;
    padding-block-end: 0;
    padding-inline-start: 0;
    padding-inline-end: 0;
  }
  
  .filter-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .filter-hint {
    font-size: 0.75rem;
    font-weight: 400;
    color: #94a3b8;
  }
  
  /* Keyword Input */
  .keyword-input {
    width: 100%;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    color: #f1f5f9;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    outline: none;
  }
  
  .keyword-input::placeholder {
    color: #94a3b8;
  }
  
  .keyword-input:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(59, 130, 246, 0.3);
  }
  
  .keyword-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
  
  .keyword-input.error {
    border-color: #ef4444;
  }
  
  .keyword-input.error:focus {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }
  
  .error-message {
    font-size: 0.75rem;
    color: #ef4444;
    margin: 0;
    padding: 0.25rem 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
  }
  
  /* Keyword Tags */
  .keyword-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .keyword-tag {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  /* Checkbox Group */
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    margin: 0;
  }
  
  .checkbox-label:hover {
    background: rgba(59, 130, 246, 0.1);
  }
  
  .checkbox-input {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #334155;
    background: rgba(30, 41, 59, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    position: relative;
  }
  
  .checkbox-input:checked {
    background: #3b82f6;
    border-color: #3b82f6;
  }
  
  .checkbox-input:checked::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 5px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  
  .checkbox-input:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }
  
  .checkbox-text {
    font-size: 0.875rem;
    color: #f1f5f9;
    user-select: none;
  }
  
  /* Apply Button */
  .apply-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: #3b82f6;
    border: none;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .apply-button:hover {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  
  .apply-button:active {
    transform: translateY(0);
  }
  
  .apply-button:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .filter-panel {
      padding: 1rem;
      gap: 1rem;
    }
    
    .panel-title {
      font-size: 1rem;
    }
    
    .clear-button {
      font-size: 0.75rem;
      padding: 0.375rem 0.75rem;
    }
  }
</style>
