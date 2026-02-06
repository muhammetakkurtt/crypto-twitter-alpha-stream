import type { TwitterEvent, PostData, FollowingData } from '$lib/types';
import { toastStore } from '$lib/stores/toast.svelte';

export function shouldNotifyForEvent(event: TwitterEvent): boolean {
  switch (event.type) {
    case 'follow_created':
      return true;
    case 'profile_updated':
      return true;
    case 'profile_pinned':
      return true;
    case 'post_created': {
      const postData = event.data as PostData;
      if (postData.tweet?.metrics) {
        const likes = postData.tweet.metrics.likes || 0;
        const retweets = postData.tweet.metrics.retweets || 0;
        return likes > 100 || retweets > 50;
      }
      return false;
    }
    default:
      return false;
  }
}

export function getEventNotificationMessage(event: TwitterEvent): string {
  const username = event.user.displayName || event.user.username;
  
  switch (event.type) {
    case 'follow_created': {
      const followData = event.data as FollowingData;
      const followingName = followData.following?.profile?.name || followData.following?.handle || 'someone';
      return `${username} followed ${followingName}`;
    }
    case 'profile_updated':
      return `${username} updated their profile`;
    case 'profile_pinned':
      return `${username} pinned a new tweet`;
    case 'post_created': {
      const postData = event.data as PostData;
      const likes = postData.tweet?.metrics?.likes || 0;
      const retweets = postData.tweet?.metrics?.retweets || 0;
      if (likes > 100 || retweets > 50) {
        return `${username} posted a popular tweet (${likes} likes, ${retweets} retweets)`;
      }
      return `${username} posted a new tweet`;
    }
    default:
      return `New ${event.type} event from ${username}`;
  }
}

export function notifyForImportantEvent(event: TwitterEvent): void {
  if (shouldNotifyForEvent(event)) {
    const message = getEventNotificationMessage(event);
    toastStore.info(message, 5000);
  }
}
