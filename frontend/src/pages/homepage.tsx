// React and hooks for state, refs, and effects
// Import two images for the running animation
import poyoRun1 from '../assets/poyoRun1.png';
import poyoRun2 from '../assets/poyoRun2.png';

const Homepage = () => {
  // Ref to the bottom section for intersection observer
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // State: is the bottom section visible?
  const [isAtBottom, setIsAtBottom] = useState(false);
  // State: which frame of the running animation to show
  const [frame, setFrame] = useState(0);

  // Set up intersection observer to detect when bottom section is in view
  useEffect(() => {
    if (!bottomRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsAtBottom(true); // Show running animation
          } else {
            setIsAtBottom(false); // Hide running animation
          }
        });
      },
      { root: null, threshold: 0.6 }
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  // When at bottom, toggle between two frames to animate running
  useEffect(() => {
    let timer: number | undefined;
    if (isAtBottom) {
      timer = window.setInterval(() => {
        setFrame((f) => (f === 0 ? 1 : 0));
      }, 200); // Switch frame every 200ms
    } else {
      setFrame(0); // Reset to first frame
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isAtBottom]);

  return (
    // Main homepage container with background image and flex layout
    <div
      className="homepage"
      style={{
        backgroundImage: `url('/gardenbg.JPG')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}>
      {/* Content wrapper for all homepage sections */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '50vh', // Large vertical gap between sections
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 4rem',
          paddingTop: '35vh', // Push content down from top
        }}>
        {/* Welcome section */}
        <div
          style={{
            color: 'white',
            textAlign: 'left',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
          }}>
          <h1>Welcome to Aethernet</h1>
          {/* Project description with a manual line break and bolded keywords */}
          <p>
            Aethernet is a real-time potion flow monitoring dashboard that tracks dozens of enchanted cauldrons across Poyo's factory.<br/>
            It visualizes the <strong>entire network</strong>, replays <strong>historical data</strong>, and implements <strong>intelligent algorithms</strong> to match transport tickets to drain events.
          </p>
        </div>
        {/* Scroll prompt section */}
        <div
          style={{
            color: 'white',
            justifyContent: 'center',
            textAlign: 'center', // Center the text horizontally
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
          }}>
          <h2 style={{
            fontFamily: 'EB Garamond, Garamond, serif',
            marginBottom: '0.3em', // Decrease gap below h2
            fontSize: '2.5rem',
          }}>
            Deep within Poyo's Potion Factory...
          </h2>
          <p style={{ 
            marginTop: 0,
            fontFamily: 'EB Garamond, Garamond, serif',
            fontSize: '1.5rem',
            }}>
            dozens of enchanted cauldrons bubble away, collecting potions from brewing towers spread across the facility. <br/> Each cauldron fills at its own pace before courier witches swoop in to haul the precious brews to the Enchanted Market.
          </p>
        </div>
        {/* Bottom section with running animation */}
        <div
          ref={bottomRef}
          style={{
            color: 'white',
            textAlign: 'left',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
          }}>
          {/* Animated poyo runner, only visible when at bottom */}
          <div className="poyo-container" aria-hidden={!isAtBottom}>
            <img
              src={frame === 0 ? poyoRun1 : poyoRun2}
              alt="poyo running"
              className="poyo-run"
              style={{ visibility: isAtBottom ? 'visible' : 'hidden' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
