import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('+page.svelte Integration Tests', () => {
  const pageContent = readFileSync(join(__dirname, '+page.svelte'), 'utf-8');

  it('should import socketStore', () => {
    expect(pageContent).toContain("import { socketStore } from '$lib/stores/socket.svelte'");
  });

  it('should import Header component', () => {
    expect(pageContent).toContain("import Header from '$lib/components/Header.svelte'");
  });

  it('should import MainLayout component', () => {
    expect(pageContent).toContain("import MainLayout from '$lib/components/MainLayout.svelte'");
  });

  it('should import EventFeed component', () => {
    expect(pageContent).toContain("import EventFeed from '$lib/components/EventFeed.svelte'");
  });

  it('should import UserList component', () => {
    expect(pageContent).toContain("import UserList from '$lib/components/UserList.svelte'");
  });

  it('should import RightSidebar component', () => {
    expect(pageContent).toContain("import RightSidebar from '$lib/components/RightSidebar.svelte'");
  });

  it('should import sidebarStore', () => {
    expect(pageContent).toContain("import { sidebarStore } from '$lib/stores/sidebar.svelte'");
  });

  it('should import onMount and onDestroy from svelte', () => {
    expect(pageContent).toContain("import { onMount, onDestroy } from 'svelte'");
  });

  it('should initialize socket connection on mount', () => {
    expect(pageContent).toContain('onMount');
    expect(pageContent).toContain('socketStore.connect()');
  });

  it('should cleanup socket on unmount', () => {
    expect(pageContent).toContain('onDestroy');
    expect(pageContent).toContain('socketStore.disconnect()');
  });

  it('should have error boundary state', () => {
    expect(pageContent).toContain('errorMessage');
    expect(pageContent).toContain('hasError');
  });

  it('should have error boundary UI', () => {
    expect(pageContent).toContain('error-boundary');
    expect(pageContent).toContain('Something went wrong');
    expect(pageContent).toContain('Reload Page');
  });

  it('should have try-catch for socket connection', () => {
    expect(pageContent).toContain('try');
    expect(pageContent).toContain('catch');
    expect(pageContent).toContain('console.error');
  });

  it('should set page title and meta description', () => {
    expect(pageContent).toContain('svelte:head');
    expect(pageContent).toContain('Crypto Twitter Stream - Real-time Alpha Monitor');
    expect(pageContent).toContain('Real-time crypto Twitter event streaming dashboard');
  });

  it('should render Header component', () => {
    expect(pageContent).toContain('<Header />');
  });

  it('should render MainLayout with snippets', () => {
    expect(pageContent).toContain('<MainLayout>');
    expect(pageContent).toContain('{#snippet centerPanel()}');
  });

  it('should render UserList as fixed sidebar', () => {
    expect(pageContent).toContain('<UserList />');
    // UserList is rendered at root level but as a fixed sidebar, not an overlay
  });

  it('should render RightSidebar as overlay', () => {
    expect(pageContent).toContain('<RightSidebar />');
  });

  it('should render EventFeed in center panel', () => {
    expect(pageContent).toContain('<EventFeed />');
  });

  it('should have ARIA live region for sidebar announcements', () => {
    expect(pageContent).toContain('role="status"');
    expect(pageContent).toContain('aria-live="polite"');
    expect(pageContent).toContain('sidebarAnnouncement');
  });

  it('should track only right sidebar state for ARIA announcements', () => {
    expect(pageContent).toContain('previousRightState');
    expect(pageContent).not.toContain('previousLeftState');
    expect(pageContent).not.toContain('previousFocusMode');
  });

  it('should announce only right sidebar state changes', () => {
    expect(pageContent).toContain('Right sidebar closed. Filters and statistics hidden.');
    expect(pageContent).toContain('Right sidebar opened. Filters and statistics visible.');
    expect(pageContent).not.toContain('Left sidebar closed. User list hidden.');
    expect(pageContent).not.toContain('Left sidebar opened. User list visible.');
    expect(pageContent).not.toContain('Focus mode activated');
    expect(pageContent).not.toContain('Focus mode deactivated');
  });

  it('should have main content with proper z-index', () => {
    expect(pageContent).toContain('id="main-content"');
    expect(pageContent).toContain('z-index: 1');
  });

  it('should have screen reader only class', () => {
    expect(pageContent).toContain('sr-only');
  });

  it('should have app-container class', () => {
    expect(pageContent).toContain('app-container');
  });

  it('should have global body styles', () => {
    expect(pageContent).toContain(':global(body)');
  });

  it('should handle error display conditionally', () => {
    expect(pageContent).toContain('{#if hasError}');
    expect(pageContent).toContain('{:else}');
  });

  it('should have keyboard shortcuts help modal', () => {
    expect(pageContent).toContain('showShortcutsHelp');
    expect(pageContent).toContain('shortcuts-modal');
    expect(pageContent).toContain('Keyboard Shortcuts');
  });

  it('should not include Ctrl+B shortcut in help modal', () => {
    // Ctrl+B was for toggling left sidebar, which is now fixed
    const ctrlBPattern = /<kbd>Ctrl<\/kbd>\s*\+\s*<kbd>B<\/kbd>/;
    expect(pageContent).not.toMatch(ctrlBPattern);
    expect(pageContent).not.toContain('Toggle left sidebar (user list)');
  });

  it('should include Ctrl+F shortcut in help modal', () => {
    // Ctrl+F is for toggling right sidebar, which remains as overlay
    const ctrlFPattern = /<kbd>Ctrl<\/kbd>\s*\+\s*<kbd>F<\/kbd>/;
    expect(pageContent).toMatch(ctrlFPattern);
    expect(pageContent).toContain('Toggle right sidebar (filters & stats)');
  });

  it('should not include focus mode shortcut in help modal', () => {
    // Focus mode (Ctrl+Shift+F) is removed since left sidebar is always visible
    expect(pageContent).not.toContain('Toggle focus mode');
    expect(pageContent).not.toContain('hide all sidebars');
  });

  it('should verify RightSidebar remains as overlay', () => {
    // RightSidebar should still be rendered as an overlay
    expect(pageContent).toContain('<RightSidebar />');
    // Comment in code confirms it's an overlay
    expect(pageContent).toContain('Overlay Sidebars');
  });
});
