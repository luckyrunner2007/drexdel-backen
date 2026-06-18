export function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

/**
 * PROJECT DREXDEL - CHRONOLOGICAL DATA FORMATTER UTILITY
 * FILE: src/utils/dateTimeFormatter.ts
 */

/**
 * Transforms an ISO database timestamp into an elegant event interface display string.
 * Example Input: "2026-06-25T20:00:00Z" ──> Output: "Thursday, Jun 25 • 08:00 PM"
 */
export const formatEventDateTime = (isoString: string): string => {
  try {
    const eventDate = new Date(isoString);
    
    // Fallback if the string parsing results in an Invalid Date object
    if (isNaN(eventDate.getTime())) {
      return 'Date Unavailable';
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    const formattedDate = eventDate.toLocaleDateString('en-US', dateOptions);
    const formattedTime = eventDate.toLocaleTimeString('en-US', timeOptions);

    return `${formattedDate} • ${formattedTime}`;
  } catch (error) {
    console.error('[Date Formatter] Error parsing event date-time schema:', error);
    return 'Date Unavailable';
  }
};

/**
 * Calculates a relative countdown clock for chat rooms and disappearing stories.
 */
export const getRelativeTimeMarker = (isoString: string): string => {
  try {
    const eventDate = new Date(isoString);
    
    if (isNaN(eventDate.getTime())) {
      return 'Recent';
    }

    const timestampMs = eventDate.getTime();
    const currentMs = Date.now();
    const differenceSeconds = Math.floor((currentMs - timestampMs) / 1000);

    if (differenceSeconds < 60) return 'Just now';
    
    const differenceMinutes = Math.floor(differenceSeconds / 60);
    if (differenceMinutes < 60) return `${differenceMinutes}m ago`;
    
    const differenceHours = Math.floor(differenceMinutes / 60);
    if (differenceHours < 24) return `${differenceHours}h ago`;

    return eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    console.error('[Date Formatter] Error executing relative timeline marker metrics:', error);
    return 'Recent';
  }
};
