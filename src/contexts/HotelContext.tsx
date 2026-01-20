import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Hotel {
  id: string;
  hotel_code: string;
  hotel_name: string;
}

interface HotelContextType {
  hotel: Hotel | null;
  setHotel: (hotel: Hotel | null) => void;
  clearHotel: () => void;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [hotel, setHotelState] = useState<Hotel | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('current_hotel');
    if (stored) {
      try {
        setHotelState(JSON.parse(stored));
      } catch {
        localStorage.removeItem('current_hotel');
      }
    }
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

  return (
    <HotelContext.Provider value={{ hotel, setHotel, clearHotel }}>
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
