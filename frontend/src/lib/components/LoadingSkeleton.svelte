<script lang="ts">
  let { 
    variant = 'card',
    count = 1 
  }: { 
    variant?: 'card' | 'avatar' | 'text' | 'button' | 'image';
    count?: number;
  } = $props();
</script>

<div class="skeleton-container">
  {#each Array(count) as _, index (index)}
    {#if variant === 'card'}
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text-group">
            <div class="skeleton-text skeleton-text-title"></div>
            <div class="skeleton-text skeleton-text-subtitle"></div>
          </div>
        </div>
        <div class="skeleton-content">
          <div class="skeleton-text skeleton-text-full"></div>
          <div class="skeleton-text skeleton-text-full"></div>
          <div class="skeleton-text skeleton-text-half"></div>
        </div>
        <div class="skeleton-image"></div>
        <div class="skeleton-footer">
          <div class="skeleton-button"></div>
        </div>
      </div>
    {:else if variant === 'avatar'}
      <div class="skeleton-avatar"></div>
    {:else if variant === 'text'}
      <div class="skeleton-text skeleton-text-full"></div>
    {:else if variant === 'button'}
      <div class="skeleton-button"></div>
    {:else if variant === 'image'}
      <div class="skeleton-image"></div>
    {/if}
  {/each}
</div>

<style>
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  /* Base Skeleton Animation */
  @keyframes skeleton-loading {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .skeleton-card,
  .skeleton-avatar,
  .skeleton-text,
  .skeleton-button,
  .skeleton-image {
    background: rgba(30, 41, 59, 0.6);
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: var(--radius-md);
  }
  
  /* Card Skeleton */
  .skeleton-card {
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(51, 65, 85, 0.5);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .skeleton-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .skeleton-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .skeleton-text-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }
  
  .skeleton-text {
    height: 12px;
    border-radius: var(--radius-sm);
  }
  
  .skeleton-text-title {
    width: 40%;
    height: 16px;
  }
  
  .skeleton-text-subtitle {
    width: 30%;
    height: 12px;
  }
  
  .skeleton-text-full {
    width: 100%;
  }
  
  .skeleton-text-half {
    width: 60%;
  }
  
  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .skeleton-image {
    width: 100%;
    height: 200px;
    border-radius: var(--radius-lg);
  }
  
  .skeleton-footer {
    display: flex;
    gap: 0.75rem;
  }
  
  .skeleton-button {
    width: 120px;
    height: 36px;
    border-radius: var(--radius-md);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .skeleton-card {
      padding: 1rem;
    }
    
    .skeleton-avatar {
      width: 40px;
      height: 40px;
    }
    
    .skeleton-image {
      height: 150px;
    }
  }
</style>
