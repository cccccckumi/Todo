import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useTaskMotion.js';

export default function AnimatedCount({ value, className = '', suffix = '', displayValue = value }) {
  const previous = useRef(value);
  const reduced = useReducedMotion();
  const [animation, setAnimation] = useState({ key: 0, direction: 'up' });
  useLayoutEffect(() => {
    if (previous.current === value) return;
    const direction = value > previous.current ? 'up' : 'down';
    previous.current = value;
    if (!reduced) setAnimation((current) => ({ key: current.key + 1, direction }));
  }, [value, reduced]);
  return (
    <span className={`animated-count ${className}`} data-count={value}>
      <span className="count-viewport" aria-hidden="true"><span key={animation.key} className={`count-value${animation.key && !reduced ? ` count-${animation.direction}` : ''}`}>{displayValue}</span></span>
      <span className="sr-only">{value}{suffix}</span>
    </span>
  );
}
