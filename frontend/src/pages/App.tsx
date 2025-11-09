import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import '../styles/App.css'
import Homepage from './Homepage'
import Map from './Map'
import cloudLogo from '../assets/pixelarticons--cloud.png'
import whiteCloudLogo from '../assets/whiteCloudLogo.png'
import { useState, useEffect } from 'react'

function App() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Router>
      <div className="app">
        <nav className={`navigation ${isScrolled ? 'scrolled' : ''}`}>
          <div className="nav-content">
            <img 
              src={isScrolled ? cloudLogo : whiteCloudLogo} 
              alt="Cloud Logo" 
              className="nav-logo"
            />
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
