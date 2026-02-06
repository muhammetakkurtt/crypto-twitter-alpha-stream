<script lang="ts">
  import { statsStore } from '$lib/stores/stats.svelte';
  import { onMount } from 'svelte';
  
  const eventsPerMin = $derived(statsStore.eventsPerMin);
  const delivered = $derived(statsStore.delivered);
  const deduped = $derived(statsStore.deduped);
  const total = $derived(statsStore.total);
  
  let mounted = $state(false);
  
  onMount(() => {
    mounted = true;
  });
</script>

<section class="stats-panel" aria-labelledby="stats-title">
  <div class="panel-header">
    <h2 id="stats-title" class="panel-title">Statistics</h2>
    <div class="status-indicator" class:active={mounted} role="status" aria-label="Connection status">
      <span class="status-dot"></span>
      <span class="status-text">Live</span>
    </div>
  </div>
  
  <div class="stats-grid" role="region" aria-live="polite" aria-label="Real-time statistics">
    <!-- Events Per Minute -->
    <div class="stat-item primary" role="status" aria-label="Events per minute rate">
      <div class="stat-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Events/Min</div>
        <div class="stat-value" data-testid="events-per-min" aria-label="{eventsPerMin} events per minute">
          {eventsPerMin}
        </div>
      </div>
    </div>
    
    <!-- Delivered Count -->
    <div class="stat-item success" role="status" aria-label="Delivered events count">
      <div class="stat-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Delivered</div>
        <div class="stat-value" data-testid="delivered-count" aria-label="{delivered.toLocaleString()} delivered events">
          {delivered.toLocaleString()}
        </div>
      </div>
    </div>
    
    <!-- Deduped Count -->
    <div class="stat-item warning" role="status" aria-label="Deduplicated events count">
      <div class="stat-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Deduped</div>
        <div class="stat-value" data-testid="deduped-count" aria-label="{deduped.toLocaleString()} deduplicated events">
          {deduped.toLocaleString()}
        </div>
      </div>
    </div>
    
    <!-- Total Count -->
    <div class="stat-item info" role="status" aria-label="Total events count">
      <div class="stat-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Total</div>
        <div class="stat-value" data-testid="total-count" aria-label="{total.toLocaleString()} total events">
          {total.toLocaleString()}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .stats-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid #334155;
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
  }
  
  .stats-panel:hover {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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
  
  /* Status Indicator */
  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    transition: all 0.3s ease;
    min-width: 70px;
  }
  
  .status-indicator.active {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }
  
  .status-indicator.active .status-dot {
    background: #22c55e;
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    }
    50% {
      opacity: 0.8;
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
    }
  }
  
  .status-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    transition: color 0.3s ease;
    white-space: nowrap;
  }
  
  .status-indicator.active .status-text {
    color: #22c55e;
  }
  
  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  /* Stat Item */
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.25rem 1rem;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    min-height: 100px;
  }
  
  .stat-item:hover {
    transform: translateY(-2px);
  }
  
  /* Stat Item Variants */
  .stat-item.primary {
    border-color: rgba(59, 130, 246, 0.3);
  }
  
  .stat-item.primary:hover {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }
  
  .stat-item.success {
    border-color: rgba(34, 197, 94, 0.3);
  }
  
  .stat-item.success:hover {
    border-color: rgba(34, 197, 94, 0.5);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
  }
  
  .stat-item.warning {
    border-color: rgba(234, 179, 8, 0.3);
  }
  
  .stat-item.warning:hover {
    border-color: rgba(234, 179, 8, 0.5);
    box-shadow: 0 4px 12px rgba(234, 179, 8, 0.2);
  }
  
  .stat-item.info {
    border-color: rgba(168, 85, 247, 0.3);
  }
  
  .stat-item.info:hover {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }
  
  /* Stat Icon */
  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    flex-shrink: 0;
    transition: all 0.3s ease;
  }
  
  .stat-item.primary .stat-icon {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .stat-item.success .stat-icon {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  .stat-item.warning .stat-icon {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }
  
  .stat-item.info .stat-icon {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }
  
  .stat-item:hover .stat-icon {
    transform: scale(1.1);
  }
  
  /* Stat Content */
  .stat-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }
  
  .stat-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
  }
  
  /* Number Animation */
  @keyframes countUp {
    from {
      opacity: 0.5;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .stat-value {
    animation: countUp 0.3s ease-out;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .stats-panel {
      padding: 1rem;
      gap: 1rem;
    }
    
    .panel-title {
      font-size: 1rem;
    }
    
    .stat-item {
      padding: 1rem 0.75rem;
      min-height: 90px;
    }
    
    .stat-icon {
      width: 40px;
      height: 40px;
    }
    
    .stat-label {
      font-size: 0.625rem;
    }
    
    .stat-value {
      font-size: 1.5rem;
    }
  }
  
  @media (min-width: 1024px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
