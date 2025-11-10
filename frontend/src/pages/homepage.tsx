import React, { useEffect, useRef, useState } from "react";
import poyoRun1 from "../assets/poyoRun1.png";
import poyoRun2 from "../assets/poyoRun2.png";

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
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "50vh",
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 4rem",
          paddingTop: "35vh",
        }}
      >
        <div
          style={{
            color: "white",
            textAlign: "left",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
          }}
        >
          <h1>Aethernet</h1>
          <p>
            Your command center for tracking every bubble, drip,<br></br> and
            suspicious disappearance across Poyo's entire operation.
          </p>
        </div>

        <div
          style={{
            color: "white",
            textAlign: "left",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
          }}
        >
          <h2>What does Aethernet do?</h2>

          <div style={{ marginBottom: "16px" }}>
            <p>✦ Visualizes the Entire Potion Network</p>
            <p style={{ fontSize: "1.1em", opacity: 0.9, marginLeft: "24px" }}>
              See all cauldrons, potion levels, and the Enchanted Market sales
              point on an interactive map
            </p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <p>✦ Travels Through Time</p>
            <p style={{ fontSize: "1.1em", opacity: 0.9, marginLeft: "24px" }}>
              Replay historical potion levels and transport ticket activity from
              any day
            </p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <p>✦ Detects the Undetectable</p>
            <p style={{ fontSize: "1.1em", opacity: 0.9, marginLeft: "24px" }}>
              Automatically matches tickets to drain events and identifies
              volume discrepancies
            </p>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <p>✦ Implements Smart Ticket Matching</p>
            <p style={{ fontSize: "1.1em", opacity: 0.9, marginLeft: "24px" }}>
              Dynamic algorithms adapt to changing data and flag suspicious
              activity in real-time
            </p>
          </div>
        </div>

        <div
          ref={bottomRef}
          style={{
            color: "white",
            textAlign: "left",
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
          }}
        >
          <h2>Ready to Investigate?</h2>
          <p>
            Your monitoring station is live. The data is flowing. What will you
            discover?
          </p>

          {/* centered poyo runner */}
          <div className="poyo-container" aria-hidden={!isAtBottom}>
            <img
              src={frame === 0 ? poyoRun1 : poyoRun2}
              alt="poyo running"
              className="poyo-run"
              style={{ visibility: isAtBottom ? "visible" : "hidden" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
