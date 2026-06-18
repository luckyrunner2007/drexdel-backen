/**
 * PROJECT DREXDEL - SWR HIGH-PERFORMANCE DATA FEED CACHE LAYER
 * FILE: src/state/EventContext.tsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DrexdelEvent, EventCategory } from '../@types/events';
import { eventsApi } from '../services/api/eventsApi';

interface EventContextType {
  events: DrexdelEvent[];
  isFetchingEvents: boolean;
  refreshGlobalFeed: (forceServerFetch?: boolean) => Promise<void>;
  getFilteredAndAlgorithmicEvents: (userInterests: EventCategory[], activeFilter: string, search: string) => DrexdelEvent[];
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<DrexdelEvent[]>([]);
  const [isFetchingEvents, setIsFetchingEvents] = useState<boolean>(true);
  const [lastCacheSyncTimestamp, setLastCacheSyncTimestamp] = useState<number>(0);

  useEffect(() => {
    refreshGlobalFeed(); // Initial bootstrap fetch loop execution on setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * STALE-WHILE-REVALIDATE INGESTION LOGIC
   * Protects backend servers from experiencing a resource bottleneck by restricting duplicate fetches.
   */
  const refreshGlobalFeed = async (forceServerFetch: boolean = false) => {
    const currentUnixTimeMs = Date.now();
    const cacheAgeSeconds = (currentUnixTimeMs - lastCacheSyncTimestamp) / 1000;

    // STRIKE CONTROL: If data was updated within the last 5 minutes (300s), skip hitting the database entirely.
    // The app will continue displaying the memory cache layer instantly, saving massive server bandwidth.
    if (events.length > 0 && cacheAgeSeconds < 300 && !forceServerFetch) {
      console.log(`[Cache Manager] Serving event dataset directly from local RAM cache. Age: ${cacheAgeSeconds.toFixed(0)}s`);
      setIsFetchingEvents(false);
      return;
    }

    setIsFetchingEvents(true);
    try {
      console.log('[Cache Manager] Cache stale or force triggered. Syncing background servers data pipelines...');
      const response = await eventsApi.fetchAllEvents();
      
      if (response.success && response.data) {
        // Only trigger an inner device layout state redraw if new or shifted array lengths are caught
        if (JSON.stringify(response.data) !== JSON.stringify(events)) {
          setEvents(response.data);
        }
        setLastCacheSyncTimestamp(Date.now());
      }
    } catch (err) {
      console.error('[Cache Manager] Background data polling error:', err);
    } finally {
      setIsFetchingEvents(false);
    }
  };

  const getFilteredAndAlgorithmicEvents = (userInterests: EventCategory[], activeFilter: string, search: string): DrexdelEvent[] => {
    let result = events.filter(event => {
      const matchCategory = activeFilter === 'all' || event.category === activeFilter;
      const matchSearch = event.title.toLowerCase().includes(search.toLowerCase()) || 
                          event.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
      return matchCategory && matchSearch;
    });

    return [...result].sort((a, b) => {
      const aPreferred = userInterests.includes(a.category);
      const bPreferred = userInterests.includes(b.category);
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return 0;
    });
  };

  return (
    <EventContext.Provider value={{ events, isFetchingEvents, refreshGlobalFeed, getFilteredAndAlgorithmicEvents }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventContext);
  if (context === undefined) throw new Error('useEvents context layout boundaries exceeded.');
  return context;
};
