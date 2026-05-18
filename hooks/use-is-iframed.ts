import { useEffect, useState } from 'react';

export function useIsIframed(): boolean {
  const [isIframed, setIsIframed] = useState(false);
  useEffect(() => {
    setIsIframed(window.self !== window.top);
  }, []);
  return isIframed;
}
