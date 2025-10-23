
import { useState, useEffect } from 'react';

interface GeolocationState {
  loading: boolean;
  error: GeolocationPositionError | null;
  data: GeolocationCoordinates | null;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    data: null,
  });

  const getLocation = () => {
    setState({ loading: true, error: null, data: null });
    if (!navigator.geolocation) {
      setState(s => ({ ...s, loading: false, error: { code: 0, message: "Geolocalização não é suportada pelo seu navegador.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }}));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({ loading: false, error: null, data: position.coords });
      },
      (error) => {
        setState({ loading: false, error, data: null });
      }
    );
  };

  return { ...state, getLocation };
};
