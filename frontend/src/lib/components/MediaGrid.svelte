<script lang="ts">
  import { useLazyLoad } from '$lib/hooks/useLazyLoad';
  import { onMount } from 'svelte';
  
  let { 
    images,
    onImageClick
  }: { 
    images: string[];
    onImageClick?: (imageUrl: string) => void;
  } = $props();
  
  const gridClass = $derived.by(() => {
    const count = images.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2';
    if (count >= 4) return 'grid-cols-2';
    return 'grid-cols-1';
  });
  
  let imageLoadStates = $state<Record<number, boolean>>({});
  let imageErrors = $state<Record<number, boolean>>({});
  let imageVisible = $state<Record<number, boolean>>({});
  let imageRefs: (HTMLImageElement | null)[] = [];
  
  const lazyLoader = useLazyLoad(
    (entry) => {
      const img = entry.target as HTMLImageElement;
      const index = parseInt(img.dataset.index || '0', 10);
      
      if (entry.isIntersecting && !imageVisible[index]) {
        imageVisible[index] = true;
        
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
      }
    },
    { rootMargin: '50px', threshold: 0.01 }
  );
  
  onMount(() => {
    imageRefs.forEach(img => {
      if (img) {
        lazyLoader.observe(img);
      }
    });
    
    return () => {
      lazyLoader.disconnect();
    };
  });
  
  function handleImageLoad(index: number) {
    imageLoadStates[index] = true;
  }
  
  function handleImageError(index: number) {
    imageErrors[index] = true;
  }
  
  function handleImageClick(imageUrl: string) {
    if (onImageClick) {
      onImageClick(imageUrl);
    }
  }
</script>

<div class="media-grid {gridClass}">
  {#each images.slice(0, 4) as image, index}
    <button
      class="media-item"
      class:span-2={images.length === 3 && index === 0}
      class:loaded={imageLoadStates[index]}
      class:error={imageErrors[index]}
      onclick={() => handleImageClick(image)}
      aria-label="View image {index + 1} of {images.length}"
      type="button"
    >
      {#if !imageErrors[index]}
        <img 
          bind:this={imageRefs[index]}
          data-src={image}
          data-index={index}
          alt="Image {index + 1} of {images.length}"
          class="media-img"
          loading="lazy"
          onload={() => handleImageLoad(index)}
          onerror={() => handleImageError(index)}
        />
      {:else}
        <div class="error-placeholder">
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Failed to load</span>
        </div>
      {/if}
      
      {#if !imageLoadStates[index] && !imageErrors[index]}
        <div class="loading-skeleton"></div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .media-grid {
    display: grid;
    gap: 0.5rem;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .grid-cols-1 {
    grid-template-columns: 1fr;
  }
  
  .grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .media-item {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: none;
    padding: 0;
    background: rgba(30, 41, 59, 0.6);
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: var(--radius-md);
  }
  
  .media-item:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .media-item:focus {
    outline: 3px solid rgba(59, 130, 246, 0.8);
    outline-offset: 2px;
  }
  
  .media-item.span-2 {
    grid-column: span 2;
  }
  
  .media-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    filter: blur(20px);
    transition: opacity 0.3s ease, filter 0.3s ease;
  }
  
  .media-item.loaded .media-img {
    opacity: 1;
    filter: blur(0);
  }
  
  .loading-skeleton {
    position: absolute;
    inset: 0;
    background: rgba(30, 41, 59, 0.6);
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .error-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #94a3b8;
    background: rgba(30, 41, 59, 0.8);
  }
  
  .error-placeholder span {
    font-size: 0.875rem;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .media-grid {
      gap: 0.25rem;
    }
    
    .media-item {
      border-radius: var(--radius-sm);
    }
  }
</style>
