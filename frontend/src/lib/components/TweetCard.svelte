<script lang="ts">
  import type { TwitterEvent, PostData } from '$lib/types';
  import { filtersStore } from '$lib/stores/filters.svelte';
  import { searchStore } from '$lib/stores/search.svelte';
  import { useLazyLoad } from '$lib/hooks/useLazyLoad';
  import { highlightSearchTerm } from '$lib/utils/highlight';
  import { onMount } from 'svelte';
  import ImageModal from './ImageModal.svelte';
  import MediaGrid from './MediaGrid.svelte';
  
  let { event }: { event: TwitterEvent } = $props();
  
  const data = $derived(event.data as PostData);
  const tweet = $derived(data.tweet);
  
  const tweetUrl = $derived.by(() => {
    if (!tweet) return '#';
    return `https://twitter.com/${tweet.author.handle}/status/${tweet.id}`;
  });
  
  const authorUrl = $derived.by(() => {
    if (!tweet) return '#';
    return `https://twitter.com/${tweet.author.handle}`;
  });
  
  let avatarRef = $state.raw<HTMLImageElement | null>(null);
  
  let selectedImageUrl = $state<string | null>(null);
  
  function handleImageClick(imageUrl: string) {
    selectedImageUrl = imageUrl;
  }
  
  function handleCloseModal() {
    selectedImageUrl = null;
  }
  
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
    const allImages = [avatarRef].filter(Boolean) as HTMLImageElement[];
    allImages.forEach(img => {
      lazyLoader.observe(img);
    });
    
    return () => {
      lazyLoader.disconnect();
    };
  });
  
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function highlightMentions(text: string, mentions?: string[]): string {
    if (!text) return '';
    
    let result = text;
    
    if (searchStore.query.trim()) {
      result = highlightSearchTerm(result, searchStore.query);
    } else {
      result = escapeHtml(result);
    }
    
    if (mentions && mentions.length > 0) {
      mentions.forEach(mention => {
        const mentionPattern = new RegExp(`@${mention}\\b`, 'gi');
        result = result.replace(
          mentionPattern,
          `<span class="mention" data-username="${mention}">@${mention}</span>`
        );
      });
    }
    
    return result;
  }
  
  function handleMentionClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('mention')) {
      const username = target.getAttribute('data-username');
      if (username) {
        filtersStore.toggleUser(username);
      }
    }
  }
  
  const formattedTime = $derived.by(() => {
    if (!tweet?.created_at) return '';
    const date = new Date(tweet.created_at);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
</script>

{#if tweet}
  <div class="tweet-card group">
    <!-- Author Section -->
    <div class="author-section">
      <a href={authorUrl} target="_blank" rel="noopener noreferrer" class="author-avatar" aria-label="View {tweet.author.profile?.name || tweet.author.handle}'s profile on Twitter (opens in new tab)">
        {#if tweet.author.profile?.avatar}
          <img 
            bind:this={avatarRef}
            data-src={tweet.author.profile.avatar}
            alt="Profile picture of {tweet.author.profile.name}"
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
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        {/if}
      </a>
      
      <div class="author-info">
        <div class="author-name-row">
          <a href={authorUrl} target="_blank" rel="noopener noreferrer" class="author-name" aria-label="View {tweet.author.profile?.name || tweet.author.handle}'s profile on Twitter (opens in new tab)">
            {tweet.author.profile?.name || tweet.author.handle}
          </a>
          {#if tweet.author.verified}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#1d9bf0"
              class="verified-badge"
            >
              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
            </svg>
          {/if}
        </div>
        <div class="author-meta">
          <a href={authorUrl} target="_blank" rel="noopener noreferrer" class="author-handle" aria-label="View @{tweet.author.handle}'s profile on Twitter (opens in new tab)">
            @{tweet.author.handle}
          </a>
          {#if formattedTime}
            <span class="tweet-time">· {formattedTime}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Tweet Text -->
    {#if tweet.body?.text}
      <div 
        class="tweet-text" 
        onclick={handleMentionClick}
        onkeydown={(e) => e.key === 'Enter' && handleMentionClick(e as any)}
        role="button"
        tabindex="0"
      >
        {@html highlightMentions(tweet.body.text, tweet.body.mentions)}
      </div>
    {/if}
    
    <!-- Media Grid -->
    {#if tweet.media?.images && tweet.media.images.length > 0}
      <MediaGrid 
        images={tweet.media.images}
        onImageClick={handleImageClick}
      />
    {/if}
    
    <!-- Video Player -->
    {#if tweet.media?.videos && tweet.media.videos.length > 0}
      <div class="video-container">
        {#each tweet.media.videos.slice(0, 1) as video}
          <video 
            src={video} 
            controls
            class="video-player"
            preload="metadata"
            aria-label="Video attached to tweet by {tweet.author.profile?.name || tweet.author.handle}"
          >
            <track kind="captions" />
          </video>
        {/each}
      </div>
    {/if}

    <!-- Quoted Tweet -->
    {#if tweet.subtweet}
      <div class="quoted-tweet">
        <div class="quoted-author">
          {#if tweet.subtweet.author?.profile?.name}
            <span class="quoted-author-name">{tweet.subtweet.author.profile.name}</span>
          {/if}
          {#if tweet.subtweet.author?.handle}
            <span class="quoted-author-handle">@{tweet.subtweet.author.handle}</span>
          {/if}
        </div>
        {#if tweet.subtweet.body?.text}
          <div class="quoted-text">
            {tweet.subtweet.body.text}
          </div>
        {/if}
        {#if tweet.subtweet.media?.images && tweet.subtweet.media.images.length > 0}
          <MediaGrid 
            images={tweet.subtweet.media.images}
            onImageClick={handleImageClick}
          />
        {/if}
      </div>
    {/if}
    
    <!-- URLs -->
    {#if tweet.body?.urls && tweet.body.urls.length > 0}
      <div class="tweet-urls">
        {#each tweet.body.urls as url}
          <a 
            href={url.url} 
            target="_blank" 
            rel="noopener noreferrer"
            class="tweet-url"
          >
            {url.name || url.url}
          </a>
        {/each}
      </div>
    {/if}

    <!-- Metrics -->
    {#if tweet.metrics}
      <div class="tweet-metrics">
        {#if tweet.metrics.likes !== undefined}
          <div class="metric">
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
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{tweet.metrics.likes.toLocaleString()}</span>
          </div>
        {/if}
        {#if tweet.metrics.retweets !== undefined}
          <div class="metric">
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
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>{tweet.metrics.retweets.toLocaleString()}</span>
          </div>
        {/if}
        {#if tweet.metrics.replies !== undefined}
          <div class="metric">
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{tweet.metrics.replies.toLocaleString()}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="tweet-actions">
      <a 
        href={tweetUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        class="btn-view"
        aria-label="View tweet on Twitter (opens in new tab)"
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
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        View on Twitter
      </a>
    </div>
  </div>
{/if}

<!-- Image Modal -->
{#if selectedImageUrl}
  <ImageModal 
    imageUrl={selectedImageUrl}
    imageAlt="Tweet image"
    onClose={handleCloseModal}
  />
{/if}

<style>
  .tweet-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid #334155;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-bottom: 1rem;
    box-shadow: var(--shadow-md);
  }
  
  .tweet-card:hover {
    background: rgba(30, 41, 59, 1);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
  }
  
  /* Author Section */
  .author-section {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .author-avatar {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(59, 130, 246, 0.3);
    transition: all 0.3s ease;
    position: relative;
  }
  
  .author-avatar:hover {
    border-color: rgba(59, 130, 246, 0.8);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    transform: scale(1.1);
  }
  
  .author-avatar:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
  
  .author-avatar:focus:not(:focus-visible) {
    outline: none;
  }
  
  .author-avatar:focus-visible {
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
  
  .author-info {
    flex: 1;
    min-width: 0;
  }
  
  .author-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .author-name {
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .author-name:hover {
    color: #3b82f6;
  }
  
  .author-name:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  .author-name:focus:not(:focus-visible) {
    outline: none;
  }
  
  .author-name:focus-visible {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }
  
  .verified-badge {
    flex-shrink: 0;
  }
  
  .author-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }
  
  .author-handle {
    text-decoration: none;
    color: #94a3b8;
    transition: color 0.2s ease;
  }
  
  .author-handle:hover {
    color: #3b82f6;
  }
  
  .tweet-time {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-timestamp);
  }
  
  /* Tweet Text */
  .tweet-text {
    font-size: 1rem;
    line-height: 1.5;
    color: #f1f5f9;
    margin-bottom: 1rem;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  
  .tweet-text :global(.mention) {
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }
  
  .tweet-text :global(.mention:hover) {
    color: #60a5fa;
    text-decoration: underline;
  }
  
  .tweet-text :global(.search-highlight) {
    background: rgba(234, 179, 8, 0.3);
    color: #eab308;
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
    font-weight: 600;
  }
  
  /* Video Player */
  .video-container {
    margin-bottom: 1rem;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .video-player {
    width: 100%;
    max-height: 400px;
    background: #000;
  }
  
  /* Quoted Tweet */
  .quoted-tweet {
    border: 1px solid #334155;
    border-radius: var(--radius-lg);
    padding: 1rem;
    margin-bottom: 1rem;
    background: rgba(30, 41, 59, 0.4);
    transition: all 0.3s ease;
  }
  
  .quoted-tweet:hover {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(30, 41, 59, 0.6);
  }
  
  .quoted-author {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .quoted-author-name {
    font-weight: 700;
    color: #f1f5f9;
  }
  
  .quoted-author-handle {
    color: #94a3b8;
  }
  
  .quoted-text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #f1f5f9;
    margin-bottom: 0.5rem;
  }
  
  /* URLs */
  .tweet-urls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .tweet-url {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.3s ease;
    max-width: fit-content;
  }
  
  .tweet-url:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.2);
  }
  
  /* Metrics */
  .tweet-metrics {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 0;
    border-top: 1px solid #334155;
    border-bottom: 1px solid #334155;
    margin-bottom: 1rem;
  }
  
  .metric {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #94a3b8;
    font-size: 0.875rem;
  }
  
  .metric svg {
    flex-shrink: 0;
  }
  
  /* Action Buttons */
  .tweet-actions {
    display: flex;
    gap: 0.75rem;
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
    position: relative;
    overflow: hidden;
  }
  
  .btn-view:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    transform: translateY(-2px) scale(1.02);
    color: #60a5fa;
  }
  
  .btn-view:active {
    transform: translateY(0) scale(0.98);
  }
  
  .btn-view svg {
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }
  
  .btn-view:hover svg {
    transform: translateX(2px);
  }
  
  .btn-view:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
  
  .btn-view:focus:not(:focus-visible) {
    outline: none;
  }
  
  .btn-view:focus-visible {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .tweet-card {
      padding: 1rem;
    }
    
    .author-avatar {
      width: 40px;
      height: 40px;
    }
    
    .author-name {
      font-size: 0.875rem;
    }
    
    .tweet-text {
      font-size: 0.875rem;
    }
    
    .tweet-metrics {
      gap: 1rem;
    }
  }
</style>
