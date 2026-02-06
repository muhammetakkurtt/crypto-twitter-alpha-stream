<script lang="ts">
  interface Props {
    side: 'left' | 'right';
    collapsed: boolean;
    onToggle: () => void;
    ariaLabel: string;
  }
  
  let { side, collapsed, onToggle, ariaLabel }: Props = $props();
  
  // Determine chevron rotation based on side and collapsed state
  const chevronRotation = $derived.by(() => {
    if (side === 'left') {
      return collapsed ? 'rotate-0' : 'rotate-180';
    } else {
      return collapsed ? 'rotate-180' : 'rotate-0';
    }
  });
</script>

<button
  type="button"
  onclick={onToggle}
  class="sidebar-toggle"
  aria-label={ariaLabel}
  aria-expanded={!collapsed}
>
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
    class="chevron-icon {chevronRotation}"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
</button>

<style>
  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(51, 65, 85, 0.5);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    /* Ensure touch target is at least 44px on mobile */
    min-width: 44px;
    min-height: 44px;
  }
  
  .sidebar-toggle:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.5);
    color: #3b82f6;
  }
  
  .sidebar-toggle:focus {
    outline: 3px solid rgba(59, 130, 246, 0.4);
    outline-offset: 2px;
    border-color: #3b82f6;
    color: #3b82f6;
  }
  
  .chevron-icon {
    transition: transform 0.25s ease;
  }
  
  .rotate-0 {
    transform: rotate(0deg);
  }
  
  .rotate-180 {
    transform: rotate(180deg);
  }
</style>
