import React, { useEffect, useRef, useState } from 'react';
import poyoRun1 from '../assets/poyoRun1.png';
import poyoRun2 from '../assets/poyoRun2.png';

const Homepage = () => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!bottomRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsAtBottom(true);
          } else {
            setIsAtBottom(false);
          }
        });
      },
      { root: null, threshold: 0.6 }
    );

    observer.observe(bottomRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    if (isAtBottom) {
      timer = window.setInterval(() => {
        setFrame((f) => (f === 0 ? 1 : 0));
      }, 200);
    } else {
      setFrame(0);
    }

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isAtBottom]);

  return (
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '50vh',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 4rem',
          paddingTop: '35vh',
        }}>
        <div
          style={{
            color: 'white',
            textAlign: 'left',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
          }}>
          <h1>Welcome to Aethernet</h1>
          <p>This is the homepage</p>
        </div>

        <div
          style={{
            color: 'white',
            textAlign: 'left',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
          }}>
          <h2>Scroll Down</h2>
          <p>The background image stays fixed while you scroll</p>
        </div>

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
          <h2>Bottom Section</h2>
          <p>You've reached the bottom of the page</p>

          {/* centered poyo runner */}
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
