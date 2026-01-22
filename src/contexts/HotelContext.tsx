import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Hotel {
  id: string;
  hotel_code: string;
  hotel_name: string;
}

interface HotelContextType {
  hotel: Hotel | null;
  isHotelLoading: boolean;
  setHotel: (hotel: Hotel | null) => void;
  clearHotel: () => void;
  refreshHotelFromDomain: () => Promise<void>;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [hotel, setHotelState] = useState<Hotel | null>(null);
  const [isHotelLoading, setIsHotelLoading] = useState(true);

  const isLocalHostname = (hostname: string) =>
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');

  const isGatewayHostname = (hostname: string) =>
    hostname === '4on4.world' || hostname === 'www.4on4.world';

  const loadStoredHotel = () => {
    const stored = localStorage.getItem('current_hotel');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as Hotel;
    } catch {
      localStorage.removeItem('current_hotel');
      return null;
    }
  };

  const resolveHotelByHostname = async (hostname: string): Promise<Hotel | null> => {
    const normalizedHostname = hostname.trim().toLowerCase();
    if (!normalizedHostname || isLocalHostname(normalizedHostname) || isGatewayHostname(normalizedHostname)) {
      return null;
    }

    const { data: mapping, error: mappingError } = await supabase
      .from('hotel_domains')
      .select('hotel_id, hostname')
      .ilike('hostname', normalizedHostname)
      .maybeSingle();

    if (mappingError) {
      console.warn('Failed to resolve hotel domain mapping:', mappingError.message);
      return null;
    }

    if (!mapping?.hotel_id) return null;

    const { data: hotelRow, error: hotelError } = await supabase
      .from('hotels')
      .select('id, hotel_code, hotel_name')
      .eq('id', mapping.hotel_id)
      .maybeSingle();

    if (hotelError) {
      console.warn('Failed to load hotel for domain mapping:', hotelError.message);
      return null;
    }

    if (!hotelRow) return null;

    return {
      id: hotelRow.id,
      hotel_code: hotelRow.hotel_code,
      hotel_name: hotelRow.hotel_name,
    };
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsHotelLoading(true);

      const hostname = window.location.hostname.trim().toLowerCase();

      // 4on4.world is a gateway only; do not persist or reuse any hotel selection there.
      if (isGatewayHostname(hostname)) {
        setHotelState(null);
        localStorage.removeItem('current_hotel');
      } else {
        const storedHotel = loadStoredHotel();
        if (storedHotel) setHotelState(storedHotel);
      }

      const resolved = await resolveHotelByHostname(hostname);

      if (!cancelled) {
        if (resolved) {
          setHotelState(resolved);
          localStorage.setItem('current_hotel', JSON.stringify(resolved));
        }
        setIsHotelLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const setHotel = (hotel: Hotel | null) => {
    setHotelState(hotel);
    if (hotel) {
      localStorage.setItem('current_hotel', JSON.stringify(hotel));
    } else {
      localStorage.removeItem('current_hotel');
    }
  };

  const clearHotel = () => {
    setHotelState(null);
    localStorage.removeItem('current_hotel');
  };

  const refreshHotelFromDomain = async () => {
    setIsHotelLoading(true);
    try {
      const hostname = window.location.hostname;
      const resolved = await resolveHotelByHostname(hostname);
      if (resolved) {
        setHotelState(resolved);
        localStorage.setItem('current_hotel', JSON.stringify(resolved));
      }
    } finally {
      setIsHotelLoading(false);
    }
  };

  return (
    <HotelContext.Provider value={{ hotel, isHotelLoading, setHotel, clearHotel, refreshHotelFromDomain }}>
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const context = useContext(HotelContext);
  if (context === undefined) {
    throw new Error('useHotel must be used within a HotelProvider');
  }
  return context;
}
