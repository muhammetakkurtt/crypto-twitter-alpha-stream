<script lang="ts">
  import type { TwitterEvent, ProfileData } from '$lib/types';
  import { searchStore } from '$lib/stores/search.svelte';
  import { highlightSearchTerm } from '$lib/utils/highlight';
  import { useLazyLoad } from '$lib/hooks/useLazyLoad';
  import { renderBadges } from '$lib/utils/badges';
  import { detectProfileChanges } from '$lib/utils/profileDiff';
  import { onMount } from 'svelte';
  
  let { event }: { event: TwitterEvent } = $props();
  
  const data = $derived(event.data as ProfileData);
  const user = $derived(data.user);
  
  // Badge rendering
  const badges = $derived(renderBadges(user));
  
  // Profile change detection
  const profileChanges = $derived(detectProfileChanges(data.before, user));
  
  const profileUrl = $derived.by(() => {
    if (!user) return '#';
    return `https://twitter.com/${user.handle}`;
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
  
  const pinnedTweets = $derived(data.pinned || []);
  
  let bannerRef = $state.raw<HTMLImageElement | null>(null);
  let avatarRef = $state.raw<HTMLImageElement | null>(null);
  let pinnedMediaRef = $state.raw<HTMLImageElement | null>(null);
  
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
    const allImages = [bannerRef, avatarRef, pinnedMediaRef].filter(Boolean) as HTMLImageElement[];
    allImages.forEach(img => {
      lazyLoader.observe(img);
    });
    
    return () => {
      lazyLoader.disconnect();
    };
  });
</script>

{#if user}
  <div class="profile-card group">
    <!-- Banner -->
    {#if user.profile?.banner}
      <div class="profile-banner" class:changed={profileChanges.some(c => c.field === 'banner')}>
        <img 
          bind:this={bannerRef}
          data-src={user.profile.banner}
          alt="Profile banner image for {user.profile.name || user.handle}"
          class="banner-img"
          loading="lazy"
        />
      </div>
    {:else}
      <div class="profile-banner-placeholder">
        <div class="banner-solid"></div>
      </div>
    {/if}
    
    <!-- Avatar -->
    <div class="profile-avatar-container">
      <a href={profileUrl} target="_blank" rel="noopener noreferrer" class="profile-avatar" class:changed={profileChanges.some(c => c.field === 'avatar')} aria-label="View {user.profile?.name || user.handle}'s profile on Twitter (opens in new tab)">
        {#if user.profile?.avatar}
          <img 
            bind:this={avatarRef}
            data-src={user.profile.avatar}
            alt="Profile picture of {user.profile.name}"
            class="avatar-img"
            loading="lazy"
          />
        {:else}
          <div class="avatar-placeholder">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        {/if}
      </a>
    </div>
    
    <!-- Profile Info -->
    <div class="profile-info">
      <div class="profile-header">
        <div class="profile-names">
          <div class="name-with-badges">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" class="profile-name" class:changed={profileChanges.some(c => c.field === 'name')} aria-label="View {user.profile?.name || user.handle}'s profile on Twitter (opens in new tab)">
              {user.profile?.name || user.handle}
            </a>
            {#if badges.length > 0}
              <div class="user-badges">
                {#each badges as badge}
                  <span class="badge {badge.color}" title={badge.label} aria-label={badge.label}>
                    {#if badge.icon === 'check-circle'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    {:else if badge.icon === 'lock'}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    {/if}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" class="profile-handle" aria-label="View @{user.handle}'s profile on Twitter (opens in new tab)">
            @{user.handle}
          </a>
        </div>
        <div class="profile-time">
          {formattedTime}
        </div>
      </div>
      
      <!-- Action Badge -->
      <div class="action-badge">
        {#if data.action === 'updated'}
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
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Profile Updated
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
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          New Profile
        {/if}
      </div>
      
      <!-- Profile Change Indicators -->
      {#if profileChanges.length > 0}
        <div class="profile-changes">
          <div class="changes-header">
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
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Changes Detected</span>
          </div>
          <div class="changes-list">
            {#each profileChanges as change}
              <div class="change-indicator" data-field={change.field}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{change.label}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Bio -->
      {#if user.profile?.description?.text}
        <div class="profile-bio" class:changed={profileChanges.some(c => c.field === 'bio')}>
          {#if searchStore.query.trim()}
            {@html highlightSearchTerm(user.profile.description.text, searchStore.query)}
          {:else}
            {user.profile.description.text}
          {/if}
        </div>
      {/if}
      
      <!-- Location & URL -->
      <div class="profile-meta">
        {#if user.profile?.location}
          <div class="meta-item">
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{user.profile.location}</span>
          </div>
        {/if}
        
        {#if user.profile?.url}
          <div class="meta-item">
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
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <a 
              href={user.profile.url.url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="profile-url"
            >
              {user.profile.url.name || user.profile.url.url}
            </a>
          </div>
        {/if}
        
        {#if user.jointed_at}
          <div class="meta-item">
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Joined {new Date(user.jointed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
        {/if}
      </div>
      
      <!-- Metrics -->
      {#if user.metrics}
        <div class="profile-metrics">
          {#if user.metrics.following !== undefined}
            <div class="metric">
              <span class="metric-value">{user.metrics.following.toLocaleString()}</span>
              <span class="metric-label">Following</span>
            </div>
          {/if}
          {#if user.metrics.followers !== undefined}
            <div class="metric">
              <span class="metric-value">{user.metrics.followers.toLocaleString()}</span>
              <span class="metric-label">Followers</span>
            </div>
          {/if}
          {#if user.metrics.tweets !== undefined}
            <div class="metric">
              <span class="metric-value">{user.metrics.tweets.toLocaleString()}</span>
              <span class="metric-label">Tweets</span>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Pinned Tweets -->
      {#if pinnedTweets.length > 0}
        <div class="pinned-section">
          <div class="pinned-header">
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
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </svg>
            <span>Pinned Tweet</span>
          </div>
          
          {#each pinnedTweets.slice(0, 1) as pinnedTweet}
            <div class="pinned-tweet">
              {#if pinnedTweet.body?.text}
                <div class="pinned-text">
                  {pinnedTweet.body.text}
                </div>
              {/if}
              
              {#if pinnedTweet.media?.images && pinnedTweet.media.images.length > 0}
                <div class="pinned-media">
                  <img 
                    bind:this={pinnedMediaRef}
                    data-src={pinnedTweet.media.images[0]}
                    alt="Image from pinned tweet by {user.profile?.name || user.handle}"
                    class="pinned-media-img"
                    loading="lazy"
                  />
                </div>
              {/if}
              
              {#if pinnedTweet.created_at}
                <div class="pinned-time">
                  {new Date(pinnedTweet.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- Action Button -->
    <div class="profile-actions">
      <a 
        href={profileUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        class="btn-view"
        aria-label="View {user.profile?.name || user.handle}'s profile on Twitter (opens in new tab)"
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
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        View Profile
      </a>
    </div>
  </div>
{/if}

<style>
  .profile-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(51, 65, 85, 0.5);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-bottom: 1rem;
    box-shadow: var(--shadow-md);
  }
  
  .profile-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(59, 130, 246, 0.05);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .profile-card:hover {
    background: rgba(30, 41, 59, 1);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }
  
  .profile-card:hover::before {
    opacity: 1;
  }
  
  /* Banner */
  .profile-banner {
    width: 100%;
    height: 120px;
    overflow: hidden;
    background: rgba(30, 41, 59, 0.6);
  }
  
  .banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px);
    transition: filter 0.3s ease;
  }
  
  .banner-img:global(.loaded) {
    filter: blur(0);
  }
  
  .profile-banner-placeholder {
    width: 100%;
    height: 120px;
    position: relative;
    overflow: hidden;
  }
  
  .banner-solid {
    width: 100%;
    height: 100%;
    background: rgba(59, 130, 246, 0.2);
  }
  
  /* Avatar */
  .profile-avatar-container {
    position: relative;
    padding: 0 1.5rem;
    margin-top: -48px;
    margin-bottom: 1rem;
  }
  
  .profile-avatar {
    display: block;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid #0f172a;
    background: rgba(30, 41, 59, 0.9);
    transition: all 0.3s ease;
    position: relative;
  }
  
  .profile-avatar:hover {
    border-color: rgba(59, 130, 246, 0.8);
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.5), 0 8px 16px rgba(0, 0, 0, 0.3);
    transform: scale(1.1) rotate(-5deg);
  }
  
  .profile-avatar:hover::after {
    opacity: 1;
  }
  
  .profile-avatar:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }
  
  .profile-avatar:focus:not(:focus-visible) {
    outline: none;
  }
  
  .profile-avatar:focus-visible {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
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
    background: rgba(59, 130, 246, 0.2);
    color: #94a3b8;
  }
  
  /* Profile Info */
  .profile-info {
    padding: 0 1.5rem 1.5rem;
  }
  
  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  
  .profile-names {
    flex: 1;
    min-width: 0;
  }
  
  .name-with-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .user-badges {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .badge svg {
    width: 18px;
    height: 18px;
  }
  
  .text-blue-400 {
    color: #60a5fa;
  }
  
  .text-slate-400 {
    color: #94a3b8;
  }
  
  .profile-name {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
    text-decoration: none;
    margin-bottom: 0.25rem;
    transition: color 0.2s ease;
  }
  
  .profile-name:hover {
    color: #3b82f6;
  }
  
  .profile-name:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  .profile-name:focus:not(:focus-visible) {
    outline: none;
  }
  
  .profile-name:focus-visible {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }
  
  .profile-handle {
    display: block;
    font-size: 0.875rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .profile-handle:hover {
    color: #3b82f6;
  }
  
  .profile-time {
    font-size: 0.875rem;
    color: #94a3b8;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  
  /* Action Badge */
  .action-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  
  .action-badge svg {
    flex-shrink: 0;
  }
  
  /* Profile Changes */
  .profile-changes {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  .changes-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #60a5fa;
    margin-bottom: 0.5rem;
  }
  
  .changes-header svg {
    flex-shrink: 0;
  }
  
  .changes-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .change-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #93c5fd;
  }
  
  .change-indicator svg {
    flex-shrink: 0;
    color: #60a5fa;
  }
  
  /* Changed field highlighting */
  .changed {
    position: relative;
    border: 2px solid rgba(59, 130, 246, 0.5) !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .profile-banner.changed {
    border-radius: 0;
  }
  
  .profile-avatar.changed {
    border-color: rgba(59, 130, 246, 0.8) !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.4);
  }
  
  .profile-name.changed {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    background: rgba(59, 130, 246, 0.1);
  }
  
  .profile-bio.changed {
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.05);
  }
  
  /* Bio */
  .profile-bio {
    font-size: 0.9375rem;
    line-height: 1.5;
    color: #f1f5f9;
    margin-bottom: 1rem;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  
  .profile-bio :global(.search-highlight) {
    background: rgba(255, 215, 0, 0.3);
    color: #ffd700;
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
    font-weight: 600;
  }
  
  /* Meta */
  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }
  
  .meta-item svg {
    flex-shrink: 0;
  }
  
  .profile-url {
    color: #3b82f6;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .profile-url:hover {
    color: #60a5fa;
    text-decoration: underline;
  }
  
  /* Metrics */
  .profile-metrics {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(51, 65, 85, 0.5);
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
    margin-bottom: 1rem;
  }
  
  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .metric-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }
  
  .metric-label {
    font-size: 0.875rem;
    color: #94a3b8;
  }
  
  /* Pinned Section */
  .pinned-section {
    margin-bottom: 1rem;
  }
  
  .pinned-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.75rem;
  }
  
  .pinned-header svg {
    flex-shrink: 0;
  }
  
  .pinned-tweet {
    border: 1px solid rgba(51, 65, 85, 0.5);
    border-radius: var(--radius-lg);
    padding: 1rem;
    background: rgba(30, 41, 59, 0.4);
    transition: all 0.3s ease;
  }
  
  .pinned-tweet:hover {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(30, 41, 59, 0.6);
  }
  
  .pinned-text {
    font-size: 0.9375rem;
    line-height: 1.5;
    color: #f1f5f9;
    margin-bottom: 0.75rem;
    word-wrap: break-word;
  }
  
  .pinned-media {
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: 0.75rem;
  }
  
  .pinned-media-img {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    filter: blur(15px);
    transition: filter 0.3s ease;
  }
  
  .pinned-media-img:global(.loaded) {
    filter: blur(0);
  }
  
  .pinned-time {
    font-size: 0.875rem;
    color: #94a3b8;
  }
  
  /* Actions */
  .profile-actions {
    padding: 0 1.5rem 1.5rem;
  }
  
  .btn-view {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.3s ease;
    cursor: pointer;
  }
  
  .btn-view:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
  }
  
  .btn-view svg {
    flex-shrink: 0;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .profile-banner,
    .profile-banner-placeholder {
      height: 100px;
    }
    
    .profile-avatar-container {
      padding: 0 1rem;
      margin-top: -40px;
    }
    
    .profile-avatar {
      width: 80px;
      height: 80px;
    }
    
    .profile-info {
      padding: 0 1rem 1rem;
    }
    
    .profile-name {
      font-size: 1.125rem;
    }
    
    .profile-metrics {
      gap: 1rem;
    }
    
    .profile-actions {
      padding: 0 1rem 1rem;
    }
  }
</style>
