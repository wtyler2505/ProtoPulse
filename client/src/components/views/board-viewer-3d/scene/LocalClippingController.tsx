import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function LocalClippingController({ enabled }: { enabled: boolean }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const previous = gl.localClippingEnabled;
    gl.localClippingEnabled = enabled;
    invalidate();

    return () => {
      gl.localClippingEnabled = previous;
      invalidate();
    };
  }, [enabled, gl, invalidate]);

  return null;
}
