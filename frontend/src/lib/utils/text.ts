/**
 * Escapes HTML special characters to prevent XSS attacks
 */
export function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Highlights mentions in tweet text by wrapping them in clickable spans
 */
export function highlightMentions(
  text: string,
  mentions?: Array<{ username: string }>
): string {
  if (!mentions || mentions.length === 0) {
    return escapeHtml(text);
  }
  
  let highlightedText = escapeHtml(text);
  
  mentions.forEach((mention) => {
    const username = mention.username;
    const mentionPattern = new RegExp(`@${username}\\b`, 'gi');
    
    highlightedText = highlightedText.replace(
      mentionPattern,
      `<span class="mention" data-username="${username}">@${username}</span>`
    );
  });
  
  return highlightedText;
}
