/**
 * Profile Diff Utility
 * Detects changes between before and after profile data
 */

export interface ProfileChange {
  field: 'avatar' | 'bio' | 'name' | 'banner';
  label: string;
  oldValue?: string;
  newValue?: string;
}

export interface ProfileUser {
  profile?: {
    name?: string;
    avatar?: string;
    banner?: string;
    description?: {
      text?: string;
    };
  };
}

/**
 * Detects changes between before and after profile data
 * @param before - Previous profile state
 * @param after - Current profile state
 * @returns Array of detected profile changes
 */
export function detectProfileChanges(
  before: ProfileUser | undefined,
  after: ProfileUser | undefined
): ProfileChange[] {
  // Handle missing before data gracefully
  if (!before || !before.profile) {
    return [];
  }

  // Handle missing after data
  if (!after || !after.profile) {
    return [];
  }

  const changes: ProfileChange[] = [];
  const beforeProfile = before.profile;
  const afterProfile = after.profile;

  // Check avatar changes
  if (beforeProfile.avatar !== afterProfile.avatar) {
    changes.push({
      field: 'avatar',
      label: 'Avatar updated',
      oldValue: beforeProfile.avatar,
      newValue: afterProfile.avatar
    });
  }

  // Check bio changes (description.text)
  const beforeBio = beforeProfile.description?.text;
  const afterBio = afterProfile.description?.text;
  if (beforeBio !== afterBio) {
    changes.push({
      field: 'bio',
      label: 'Bio changed',
      oldValue: beforeBio,
      newValue: afterBio
    });
  }

  // Check name changes
  if (beforeProfile.name !== afterProfile.name) {
    changes.push({
      field: 'name',
      label: 'Name changed',
      oldValue: beforeProfile.name,
      newValue: afterProfile.name
    });
  }

  // Check banner changes
  if (beforeProfile.banner !== afterProfile.banner) {
    changes.push({
      field: 'banner',
      label: 'Banner updated',
      oldValue: beforeProfile.banner,
      newValue: afterProfile.banner
    });
  }

  return changes;
}
