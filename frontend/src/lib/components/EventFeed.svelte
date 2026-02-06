<script lang="ts">
  import { onMount } from 'svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import TweetCard from './TweetCard.svelte';
  import ProfileCard from './ProfileCard.svelte';
  import FollowCard from './FollowCard.svelte';
  import LoadingSkeleton from './LoadingSkeleton.svelte';
  import type { TwitterEvent } from '$lib/types';
  
  let scrollContainer = $state<HTMLDivElement | undefined>(undefined);
  let scrollTop = $state(0);
  let isLoading = $state(false);
  let autoScrollEnabled = $state(true);
  let previousEventCount = $state(0);
  let rafId: number | null = null;
  
  const events = $derived(eventsStore.filteredEvents);
  
  function handleScroll(e: Event) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      const target = e.target as HTMLDivElement;
      scrollTop = target.scrollTop;
      
      if (scrollTop > 100) {
        autoScrollEnabled = false;
      } else if (scrollTop === 0) {
        autoScrollEnabled = true;
      }
      
      rafId = null;
    });
  }
  
  function scrollToTop() {
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      autoScrollEnabled = true;
    }
  }
  
  $effect(() => {
    if (events.length > previousEventCount && autoScrollEnabled && scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
    previousEventCount = events.length;
  });
  
  onMount(() => {
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  });
  
  function getEventComponent(event: TwitterEvent) {
    const type = event.type.toLowerCase();
    
    if (type.includes('post') || type.includes('tweet')) {
      return TweetCard;
    } else if (type.includes('profile') || type.includes('user_updated')) {
      return ProfileCard;
    } else if (type.includes('follow')) {
      return FollowCard;
    }
    
    return TweetCard;
  }
</script>

<div class="event-feed-container">
  <!-- Screen reader announcement for new events -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if events.length > 0}
      {events.length} events in feed
    {/if}
  </div>
  
  {#if isLoading}
    <div class="loading-state">
      <LoadingSkeleton variant="card" count={3} />
    </div>
  {:else if events.length === 0}
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </div>
      <h3 class="empty-title">No Events Yet</h3>
      <p class="empty-description">
        Waiting for events to stream in. Make sure you're connected to the server.
      </p>
    </div>
  {:else}
    <div 
      class="event-feed" 
      bind:this={scrollContainer}
      onscroll={handleScroll}
      role="feed"
      aria-label="Twitter events feed"
      aria-busy={isLoading}
      aria-live="polite"
    >
      <div class="feed-content">
        {#each events as event (event.primaryId || event.timestamp)}
          {@const Component = getEventComponent(event)}
          <div class="event-item">
            <Component {event} />
          </div>
        {/each}
      </div>
    </div>
    
    {#if scrollTop > 200}
      <button 
        class="scroll-to-top"
        onclick={scrollToTop}
        aria-label="Scroll to top of feed"
        tabindex="0"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    {/if}
  {/if}
</div>

<style>
  .event-feed-container {
    position: relative;
    width: 100%;
  }
  
  /* Screen reader only class */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  /* Event Feed */
  .event-feed {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .feed-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .event-item {
    width: 100%;
    animation: slideIn 0.3s ease-out;
  }
  
  .event-item :global(.tweet-card),
  .event-item :global(.profile-card),
  .event-item :global(.follow-card) {
    height: auto;
    min-height: auto;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    height: 100%;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }
  
  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1.5rem;
    padding: 2rem;
    text-align: center;
  }
  
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.1);
    border: 2px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
  }
  
  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }
  
  .empty-description {
    font-size: 1rem;
    color: #94a3b8;
    max-width: 400px;
    line-height: 1.5;
    margin: 0;
  }
  
  /* Scroll to Top Button */
  .scroll-to-top {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #3b82f6;
    border: 2px solid rgba(59, 130, 246, 0.5);
    color: #fff;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
    animation: fadeIn 0.3s ease-out;
  }
  
  .scroll-to-top:hover {
    background: #2563eb;
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(59, 130, 246, 0.4);
  }
  
  .scroll-to-top:active {
    transform: translateY(-2px) scale(1.02);
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .event-feed::-webkit-scrollbar {
      width: 4px;
    }
    
    .scroll-to-top {
      bottom: 1rem;
      right: 1rem;
      width: 48px;
      height: 48px;
    }
    
    .empty-icon {
      width: 100px;
      height: 100px;
    }
    
    .empty-icon svg {
      width: 48px;
      height: 48px;
    }
    
    .empty-title {
      font-size: 1.25rem;
    }
    
    .empty-description {
      font-size: 0.875rem;
    }
  }
</style>
