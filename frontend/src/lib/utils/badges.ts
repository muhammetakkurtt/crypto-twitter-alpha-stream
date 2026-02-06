/**
 * Badge rendering utility for user verification and privacy status
 * Provides consistent badge display across ProfileCard and FollowCard components
 */

export interface BadgeElement {
  icon: 'check-circle' | 'lock';
  color: string;
  label: string;
}

export interface UserBadges {
  verified?: boolean;
  private?: boolean;
}

/**
 * Renders badge elements for a user based on their verified and private status
 * 
 * @param user - User object with optional verified and private flags
 * @returns Array of badge elements to display
 * 
 * @example
 * // Verified user
 * renderBadges({ verified: true })
 * // Returns: [{ icon: 'check-circle', color: 'text-blue-400', label: 'Verified' }]
 * 
 * @example
 * // Private user
 * renderBadges({ private: true })
 * // Returns: [{ icon: 'lock', color: 'text-slate-400', label: 'Private' }]
 * 
 * @example
 * // Both verified and private
 * renderBadges({ verified: true, private: true })
 * // Returns both badges
 */
export function renderBadges(user: UserBadges | null | undefined): BadgeElement[] {
  const badges: BadgeElement[] = [];
  
  // Handle null/undefined user gracefully
  if (!user) {
    return badges;
  }
  
  // Add verified badge if user is verified
  if (user.verified === true) {
    badges.push({
      icon: 'check-circle',
      color: 'text-blue-400',
      label: 'Verified'
    });
  }
  
  // Add private badge if user account is private
  if (user.private === true) {
    badges.push({
      icon: 'lock',
      color: 'text-slate-400',
      label: 'Private'
    });
  }
  
  return badges;
}
