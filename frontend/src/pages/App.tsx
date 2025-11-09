
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import '../styles/App.css'
import Homepage from './homepage'
import Map from './Map'
import cloudLogo from '../assets/pixelarticons--cloud.png'
import whiteCloudLogo from '../assets/whiteCloudLogo.png'
import { useState, useEffect } from 'react'

function App() {
  // state: track whether the page has been scrolled down a bit
  const [isScrolled, setIsScrolled] = useState(false);

  // effect: attach a window scroll listener to toggle `isScrolled`
  // - when window.scrollY > 20 we consider the page "scrolled" and switch navbar styles/logo
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // cleanup: remove listener when component unmounts
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Router>
      <div className="app">
        {/* navigation bar
            - `navigation` gets an extra `scrolled` class when the page is scrolled
            - logo switches between white/colored versions based on `isScrolled`
            - links use React Router `Link` so navigation is SPA-friendly
        */}
        <nav className={`navigation ${isScrolled ? 'scrolled' : ''}`}>
          <div className="nav-content">
            {/* clicking the logo routes to the homepage */}
            <Link to="/">
              <img
                src={isScrolled ? cloudLogo : whiteCloudLogo}
                alt="Cloud Logo"
                className="nav-logo"
              />
            </Link>

            {/* primary nav links */}
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/map">Map</Link>
              </li>
            </ul>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/map" element={<Map />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
