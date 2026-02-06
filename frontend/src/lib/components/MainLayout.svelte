<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		centerPanel?: Snippet;
	}

	let { centerPanel }: Props = $props();
</script>

<div class="main-layout">
	<!-- Center Panel: Event Feed (Full Width) -->
	{#if centerPanel}
		<main class="center-panel">
			{@render centerPanel()}
		</main>
	{/if}
</div>

<style>
	.main-layout {
		width: calc(100% - 320px); /* Full width minus fixed sidebar */
		min-height: calc(100vh - 80px);
		padding: 1rem;
		margin-left: 320px; /* Offset for fixed UserList sidebar */
	}

	.center-panel {
		width: 100%;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.main-layout {
			width: 100%; /* Full width on mobile (no sidebar offset) */
			padding: 0.75rem;
			margin-left: 0; /* Remove sidebar offset on mobile */
		}
	}

	@media (max-width: 480px) {
		.main-layout {
			width: 100%; /* Full width on small mobile */
			padding: 0.5rem;
			min-height: calc(100vh - 70px);
			margin-left: 0; /* Remove sidebar offset on small mobile */
		}
	}
</style>
