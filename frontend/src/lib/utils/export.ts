import type { TwitterEvent } from '$lib/types';

export function exportToJSON(events: TwitterEvent[], filename: string = 'events.json'): void {
  const jsonString = JSON.stringify(events, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function exportToCSV(events: TwitterEvent[], filename: string = 'events.csv'): void {
  if (events.length === 0) {
    const blob = new Blob(['No events to export'], { type: 'text/csv' });
    downloadBlob(blob, filename);
    return;
  }

  const headers = [
    'Timestamp',
    'Type',
    'Username',
    'Display Name',
    'User ID',
    'Primary ID',
    'Action',
    'Content'
  ];

  const rows = events.map(event => {
    const content = extractEventContent(event);
    return [
      event.timestamp,
      event.type,
      event.user.username,
      event.user.displayName,
      event.user.userId,
      event.primaryId,
      (event.data as any).action || '',
      content
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSVCell(cell)).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

function extractEventContent(event: TwitterEvent): string {
  if (event.type === 'post_created' || event.type === 'post_updated') {
    const postData = event.data as any;
    return postData.tweet?.body?.text || '';
  } else if (event.type === 'profile_updated' || event.type === 'user_updated' || event.type === 'profile_pinned') {
    const profileData = event.data as any;
    return profileData.user?.profile?.description?.text || profileData.user?.profile?.name || '';
  } else if (event.type === 'follow_created' || event.type === 'follow_updated') {
    const followData = event.data as any;
    return `Following: ${followData.following?.handle || 'unknown'}`;
  }
  return '';
}

function escapeCSVCell(cell: string): string {
  const cellStr = String(cell);
  if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
    return `"${cellStr.replace(/"/g, '""')}"`;
  }
  return cellStr;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
