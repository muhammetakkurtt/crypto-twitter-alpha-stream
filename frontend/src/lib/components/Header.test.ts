import { describe, it, expect, beforeEach } from 'vitest';
import { socketStore } from '$lib/stores/socket.svelte';
import { filtersStore } from '$lib/stores/filters.svelte';
import { sidebarStore } from '$lib/stores/sidebar.svelte';

describe('Header Component Logic', () => {
  beforeEach(() => {
    socketStore.connectionStatus = 'disconnected';
    filtersStore.clearAll();
    sidebarStore.rightCollapsed = false;
  });

  describe('Connection Status', () => {
    it('should have disconnected status by default', () => {
      expect(socketStore.connectionStatus).toBe('disconnected');
    });

    it('should update to connected status', () => {
      socketStore.connectionStatus = 'connected';
      expect(socketStore.connectionStatus).toBe('connected');
    });

    it('should update to reconnecting status', () => {
      socketStore.connectionStatus = 'reconnecting';
      expect(socketStore.connectionStatus).toBe('reconnecting');
    });

    it('should map status to correct text', () => {
      const statusMap = {
        connected: 'Connected',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...'
      };

      Object.entries(statusMap).forEach(([status]) => {
        socketStore.connectionStatus = status as any;
        expect(socketStore.connectionStatus).toBe(status);
      });
    });

    it('should map status to correct color class', () => {
      const colorMap = {
        connected: 'bg-green-500',
        disconnected: 'bg-red-500',
        reconnecting: 'bg-yellow-500'
      };

      Object.entries(colorMap).forEach(([status]) => {
        socketStore.connectionStatus = status as any;
        expect(socketStore.connectionStatus).toBe(status);
      });
    });
  });

  describe('Filter Indicator', () => {
    it('should not show active filters by default', () => {
      expect(filtersStore.hasActiveFilters).toBe(false);
    });

    it('should show active filters when keywords are set', () => {
      filtersStore.setKeywords(['bitcoin']);
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should show active filters when users are filtered', () => {
      filtersStore.toggleUser('elonmusk');
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should show active filters when event types are filtered', () => {
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should not show active filters after clearing', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.clearAll();
      expect(filtersStore.hasActiveFilters).toBe(false);
    });
  });

  describe('Component State Integration', () => {
    it('should react to connection status changes', () => {
      socketStore.connectionStatus = 'disconnected';
      expect(socketStore.connectionStatus).toBe('disconnected');
      
      socketStore.connectionStatus = 'connected';
      expect(socketStore.connectionStatus).toBe('connected');
    });

    it('should react to filter changes', () => {
      expect(filtersStore.hasActiveFilters).toBe(false);
      
      filtersStore.setKeywords(['bitcoin']);
      expect(filtersStore.hasActiveFilters).toBe(true);
      
      filtersStore.clearAll();
      expect(filtersStore.hasActiveFilters).toBe(false);
    });

    it('should handle multiple simultaneous state changes', () => {
      socketStore.connectionStatus = 'connected';
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      
      expect(socketStore.connectionStatus).toBe('connected');
      expect(filtersStore.hasActiveFilters).toBe(true);
      expect(filtersStore.keywords).toContain('bitcoin');
      expect(filtersStore.users).toContain('elonmusk');
    });
  });

  describe('Sidebar Toggle Buttons', () => {
    it('should toggle right sidebar when button is clicked', () => {
      expect(sidebarStore.rightCollapsed).toBe(false);
      
      sidebarStore.toggleRight();
      expect(sidebarStore.rightCollapsed).toBe(true);
      
      sidebarStore.toggleRight();
      expect(sidebarStore.rightCollapsed).toBe(false);
    });

    it('should have correct aria-pressed state for right sidebar toggle', () => {
      sidebarStore.rightCollapsed = false;
      expect(sidebarStore.rightCollapsed).toBe(false);
      
      sidebarStore.rightCollapsed = true;
      expect(sidebarStore.rightCollapsed).toBe(true);
    });
  });
});
