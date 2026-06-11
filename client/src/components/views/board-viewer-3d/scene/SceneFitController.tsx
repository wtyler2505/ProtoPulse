import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function SceneFitController({ signature }: { signature: string }) {
  const { invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [invalidate, signature]);

  return null;
}
