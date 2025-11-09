import { useEffect, useRef, useState } from 'react';

interface TimelineControlProps {
  onTimeChange: (timestamp: string) => void;
  className?: string;
  isLoading?: boolean;
}

/**
 * A scrollable timeline control for visualizing historical cauldron data
 */
function TimelineControl({ onTimeChange, className = '', isLoading = false }: TimelineControlProps) {
  const [timeRange, setTimeRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    end: new Date()
  });
  const [currentTime, setCurrentTime] = useState<Date>(timeRange.end);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number>();
  const [timestamps, setTimestamps] = useState<Date[]>([]);

  // Update time range on mount by sampling the /api/Data endpoint
  useEffect(() => {
    const fetchTimeRange = async () => {
      try {
        // Query the last 24 hours and build timestamps from the results
        const endUnix = Math.floor(Date.now() / 1000);
        const startUnix = endUnix - 24 * 60 * 60;

        const res = await fetch(`/api/Data/?start_date=${startUnix}&end_date=${endUnix}`);
        if (!res.ok) throw new Error('Failed to fetch time range');
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          // Use the first and last timestamps returned by the API as range
          const firstTs = new Date(data[0].timestamp);
          const lastTs = new Date(data[data.length - 1]?.timestamp || Date.now());

          setTimeRange({ start: firstTs, end: lastTs });
          setCurrentTime(firstTs);

          // Build timeline timestamps using 15-minute increments (can be tuned)
          const intervalMs = 15 * 60 * 1000;
          const times: Date[] = [];
          for (let t = firstTs.getTime(); t <= lastTs.getTime(); t += intervalMs) {
            times.push(new Date(t));
          }
          setTimestamps(times);
        } else {
          // fallback to last 24 hours
          const now = new Date();
          setTimeRange({ start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now });
          setCurrentTime(new Date());
          setTimestamps([]);
        }
      } catch (err) {
        console.error('Error fetching time range:', err);
        const now = new Date();
        setTimeRange({ start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now });
        setCurrentTime(now);
        setTimestamps([]);
      }
    };

    fetchTimeRange();
  }, []);

  // Log timestamp count for debugging (also ensures `timestamps` is used)
  useEffect(() => {
    console.debug('Timeline timestamps count:', timestamps.length);
  }, [timestamps]);

  // Handle playback animation
  useEffect(() => {
    if (isPlaying) {
      let lastTime = performance.now();
      const animate = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        setCurrentTime(prevTime => {
          const newTime = new Date(prevTime.getTime() + deltaTime * 60); // Speed up time
          if (newTime > timeRange.end) {
            setIsPlaying(false);
            return timeRange.end;
          }
          return newTime;
        });

        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, timeRange.end]);

  // Notify parent of time changes
  useEffect(() => {
    onTimeChange(currentTime.toISOString());
  }, [currentTime, onTimeChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const timestamp = new Date(timeRange.start.getTime() + (timeRange.end.getTime() - timeRange.start.getTime()) * (value / 100));
    setCurrentTime(timestamp);
  };

  // helper removed: timestamps are not displayed in compact slider UI

  return (
    <div className={`timeline-control ${className} ${isLoading ? 'loading' : ''}`}>
      <div className="timeline-slider">
        <input
          type="range"
          min="0"
          max="100"
          value={((currentTime.getTime() - timeRange.start.getTime()) /
            (timeRange.end.getTime() - timeRange.start.getTime())) * 100}
          onChange={handleSliderChange}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}

export default TimelineControl;