<script lang="ts">
  import type { TwitterEvent, FollowingData } from '$lib/types';
  import { useLazyLoad } from '$lib/hooks/useLazyLoad';
  import { renderBadges } from '$lib/utils/badges';
  import { onMount } from 'svelte';
  
  let { event }: { event: TwitterEvent } = $props();
  
  const data = $derived(event.data as FollowingData);
  const follower = $derived(data.user);
  const followee = $derived(data.following);
  
  const followerUrl = $derived.by(() => {
    if (!follower) return '#';
    return `https://twitter.com/${follower.handle}`;
  });
  
  const followeeUrl = $derived.by(() => {
    if (!followee) return '#';
    return `https://twitter.com/${followee.handle}`;
  });
  
  const formattedTime = $derived.by(() => {
    const date = new Date(event.timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
  
  // Determine follow/unfollow based on event type and action
  const isFollowAction = $derived(
    event.type === 'follow_created' || 
    data.action === 'created' || 
    data.action === 'follow' ||
    data.action === 'follow_update'
  );
  const isUnfollowAction = $derived(
    data.action === 'deleted' || 
    data.action === 'unfollow'
  );
  
  const followerBadges = $derived.by(() => renderBadges(follower));
  const followeeBadges = $derived.by(() => renderBadges(followee));
  
  let followerAvatarRef = $state.raw<HTMLImageElement | null>(null);
  let followeeAvatarRef = $state.raw<HTMLImageElement | null>(null);
  
  const lazyLoader = useLazyLoad(
    (entry) => {
      const img = entry.target as HTMLImageElement;
      if (entry.isIntersecting && img.dataset.src) {
        img.src = img.dataset.src;
        img.onload = () => {
          img.removeAttribute('data-src');
          img.classList.add('loaded');
        };
      }
    },
    { rootMargin: '100px', threshold: 0.01 }
  );
  
  onMount(() => {
    const allImages = [followerAvatarRef, followeeAvatarRef].filter(Boolean) as HTMLImageElement[];
    allImages.forEach(img => {
      lazyLoader.observe(img);
    });
    
    return () => {
      lazyLoader.disconnect();
    };
  });
</script>

{#if follower && followee}
  <div class="follow-card group">
    <!-- Header with timestamp -->
    <div class="follow-header">
      <div class="action-badge" class:follow={isFollowAction} class:unfollow={isUnfollowAction}>
        {#if isFollowAction}
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
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          New Follow
        {:else}
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
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Unfollowed
        {/if}
      </div>
      <div class="follow-time">
        {formattedTime}
      </div>
    </div>
    
    <!-- Follow relationship display -->
    <div class="follow-relationship">
      <!-- Follower Section -->
      <div class="user-section follower-section">
        <a href={followerUrl} target="_blank" rel="noopener noreferrer" class="user-avatar" aria-label="View {follower.profile?.name || follower.handle}'s profile on Twitter (opens in new tab)">
          {#if follower.profile?.avatar}
            <img 
              bind:this={followerAvatarRef}
              data-src={follower.profile.avatar}
              alt="Profile picture of {follower.profile.name}"
              class="avatar-img"
              loading="lazy"
            />
          {:else}
            <div class="avatar-placeholder">
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
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          {/if}
        </a>
        
        <div class="user-info">
          <div class="user-name-row">
            <a href={followerUrl} target="_blank" rel="noopener noreferrer" class="user-name" aria-label="View {follower.profile?.name || follower.handle}'s profile on Twitter (opens in new tab)">
              {follower.profile?.name || follower.handle}
            </a>
            {#if followerBadges.length > 0}
              <div class="badges">
                {#each followerBadges as badge}
                  <span class="badge {badge.color}" title={badge.label}>
                    {#if badge.icon === 'check-circle'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    {:else if badge.icon === 'lock'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" />
                      </svg>
                    {/if}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <a href={followerUrl} target="_blank" rel="noopener noreferrer" class="user-handle" aria-label="View @{follower.handle}'s profile on Twitter (opens in new tab)">
            @{follower.handle}
          </a>
          
          {#if follower.profile?.description?.text}
            <div class="user-bio">
              {follower.profile.description.text.slice(0, 100)}{follower.profile.description.text.length > 100 ? '...' : ''}
            </div>
          {/if}
          
          {#if follower.metrics}
            <div class="user-metrics">
              {#if follower.metrics.followers !== undefined}
                <span class="metric-item">
                  <span class="metric-value">{follower.metrics.followers.toLocaleString()}</span>
                  <span class="metric-label">followers</span>
                </span>
              {/if}
              {#if follower.metrics.following !== undefined}
                <span class="metric-item">
                  <span class="metric-value">{follower.metrics.following.toLocaleString()}</span>
                  <span class="metric-label">following</span>
                </span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Arrow Indicator -->
      <div class="arrow-indicator" class:follow={isFollowAction} class:unfollow={isUnfollowAction}>
        <div class="arrow-content">
          {#if isFollowAction}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="arrow-icon"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span class="arrow-label">followed</span>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="arrow-icon"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <line x1="12" y1="19" x2="5" y2="12" />
              <line x1="12" y1="5" x2="5" y2="12" />
            </svg>
            <span class="arrow-label">unfollowed</span>
          {/if}
        </div>
      </div>
      
      <!-- Followee Section -->
      <div class="user-section followee-section">
        <a href={followeeUrl} target="_blank" rel="noopener noreferrer" class="user-avatar" aria-label="View {followee.profile?.name || followee.handle}'s profile on Twitter (opens in new tab)">
          {#if followee.profile?.avatar}
            <img 
              bind:this={followeeAvatarRef}
              data-src={followee.profile.avatar}
              alt="Profile picture of {followee.profile.name}"
              class="avatar-img"
              loading="lazy"
            />
          {:else}
            <div class="avatar-placeholder">
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
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          {/if}
        </a>
        
        <div class="user-info">
          <div class="user-name-row">
            <a href={followeeUrl} target="_blank" rel="noopener noreferrer" class="user-name" aria-label="View {followee.profile?.name || followee.handle}'s profile on Twitter (opens in new tab)">
              {followee.profile?.name || followee.handle}
            </a>
            {#if followeeBadges.length > 0}
              <div class="badges">
                {#each followeeBadges as badge}
                  <span class="badge {badge.color}" title={badge.label}>
                    {#if badge.icon === 'check-circle'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    {:else if badge.icon === 'lock'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z" />
                      </svg>
                    {/if}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <a href={followeeUrl} target="_blank" rel="noopener noreferrer" class="user-handle" aria-label="View @{followee.handle}'s profile on Twitter (opens in new tab)">
            @{followee.handle}
          </a>
          
          {#if followee.profile?.description?.text}
            <div class="user-bio">
              {followee.profile.description.text.slice(0, 100)}{followee.profile.description.text.length > 100 ? '...' : ''}
            </div>
          {/if}
          
          {#if followee.metrics}
            <div class="user-metrics">
              {#if followee.metrics.followers !== undefined}
                <span class="metric-item">
                  <span class="metric-value">{followee.metrics.followers.toLocaleString()}</span>
                  <span class="metric-label">followers</span>
                </span>
              {/if}
              {#if followee.metrics.following !== undefined}
                <span class="metric-item">
                  <span class="metric-value">{followee.metrics.following.toLocaleString()}</span>
                  <span class="metric-label">following</span>
                </span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .follow-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    background: rgba(29, 34, 38, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-bottom: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .follow-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(34, 197, 94, 0.05);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .follow-card:hover {
    background: rgba(30, 41, 59, 1);
    border-color: rgba(34, 197, 94, 0.5);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }
  
  .follow-card:hover::before {
    opacity: 1;
  }
  
  /* Header */
  .follow-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .action-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  
  .action-badge.follow {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  .action-badge.unfollow {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .action-badge svg {
    flex-shrink: 0;
  }
  
  .follow-time {
    font-size: 0.875rem;
    color: #8b98a5;
    font-variant-numeric: tabular-nums;
  }
  
  /* Follow Relationship */
  .follow-relationship {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  
  /* User Section */
  .user-section {
    flex: 1;
    display: flex;
    gap: 0.75rem;
    min-width: 0;
  }
  
  .user-avatar {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(34, 197, 94, 0.3);
    transition: all 0.3s ease;
    position: relative;
  }
  
  .user-avatar:hover {
    border-color: rgba(34, 197, 94, 0.8);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    transform: scale(1.1);
  }
  
  .user-avatar:focus {
    outline: 3px solid #22c55e;
    outline-offset: 2px;
  }
  
  .user-avatar:focus:not(:focus-visible) {
    outline: none;
  }
  
  .user-avatar:focus-visible {
    outline: 3px solid #22c55e;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
  }
  
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(10px);
    transition: filter 0.3s ease;
  }
  
  .avatar-img:global(.loaded) {
    filter: blur(0);
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.2);
    color: #94a3b8;
  }
  
  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .user-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  
  .badges {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .badge svg {
    width: 16px;
    height: 16px;
  }
  
  .user-name {
    font-size: 1rem;
    font-weight: 700;
    color: #e7e9ea;
    text-decoration: none;
    transition: color 0.2s ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
    min-width: 0;
  }
  
  .user-name:hover {
    color: #22c55e;
  }
  
  .user-name:focus {
    outline: 2px solid #22c55e;
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  .user-name:focus:not(:focus-visible) {
    outline: none;
  }
  
  .user-name:focus-visible {
    outline: 2px solid #22c55e;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
  }
  
  .user-handle {
    font-size: 0.875rem;
    color: #8b98a5;
    text-decoration: none;
    transition: color 0.2s ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .user-handle:hover {
    color: #22c55e;
  }
  
  .user-bio {
    font-size: 0.875rem;
    line-height: 1.4;
    color: #8b98a5;
    margin-top: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .user-metrics {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
  
  .metric-item {
    display: flex;
    gap: 0.25rem;
    color: #8b98a5;
  }
  
  .metric-value {
    font-weight: 600;
    color: #e7e9ea;
    font-variant-numeric: tabular-nums;
  }
  
  .metric-label {
    color: #8b98a5;
  }
  
  /* Arrow Indicator */
  .arrow-indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    border-radius: var(--radius-lg);
    transition: all 0.3s ease;
    position: relative;
    min-width: 120px;
  }
  
  .arrow-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  
  .arrow-label {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .arrow-indicator::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .arrow-indicator.follow {
    background: rgba(34, 197, 94, 0.1);
    border: 2px solid rgba(34, 197, 94, 0.3);
  }
  
  .arrow-indicator.follow .arrow-label {
    color: #22c55e;
  }
  
  .arrow-indicator.follow::before {
    background: rgba(34, 197, 94, 0.2);
  }
  
  .arrow-indicator.unfollow {
    background: rgba(239, 68, 68, 0.1);
    border: 2px solid rgba(239, 68, 68, 0.3);
  }
  
  .arrow-indicator.unfollow .arrow-label {
    color: #ef4444;
  }
  
  .arrow-indicator.unfollow::before {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .arrow-icon {
    transition: all 0.3s ease;
    position: relative;
    z-index: 1;
  }
  
  .arrow-indicator.follow .arrow-icon {
    color: #22c55e;
  }
  
  .arrow-indicator.unfollow .arrow-icon {
    color: #ef4444;
  }
  
  .follow-card:hover .arrow-indicator {
    transform: scale(1.1);
  }
  
  .follow-card:hover .arrow-icon {
    transform: translateX(4px);
  }
  
  .follow-card:hover .arrow-indicator::before {
    opacity: 1;
  }
  
  .follow-card:hover .arrow-indicator.follow {
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3);
    border-color: rgba(34, 197, 94, 0.6);
  }
  
  .follow-card:hover .arrow-indicator.unfollow {
    box-shadow: 0 0 30px rgba(239, 68, 68, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3);
    border-color: rgba(239, 68, 68, 0.6);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .follow-card {
      padding: 1rem;
    }
    
    .follow-relationship {
      flex-direction: column;
      gap: 1rem;
    }
    
    .user-section {
      width: 100%;
    }
    
    .arrow-indicator {
      min-width: 100%;
      padding: 0.75rem;
    }
    
    .arrow-content {
      flex-direction: row;
      gap: 0.75rem;
    }
    
    .arrow-icon {
      transform: rotate(90deg);
    }
    
    .follow-card:hover .arrow-icon {
      transform: rotate(90deg) translateX(4px);
    }
    
    .user-avatar {
      width: 48px;
      height: 48px;
    }
  }
</style>
