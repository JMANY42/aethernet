import React from 'react';

const Homepage = () => {
  return (
    <div className="homepage" style={{ 
      backgroundImage: `url('/gardenbg.JPG')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '50vh',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 4rem',
        paddingTop: '35vh'
      }}>
        <div style={{
          color: 'white',
          textAlign: 'left',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)'
        }}>
          <h1>Welcome to Aethernet</h1>
          <p>This is the homepage</p>
        </div>
        <div style={{
          color: 'white',
          textAlign: 'left',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)'
        }}>
          <h2>Scroll Down</h2>
          <p>The background image stays fixed while you scroll</p>
        </div>
        <div style={{
          color: 'white',
          textAlign: 'left',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)'
        }}>
          <h2>Bottom Section</h2>
          <p>You've reached the bottom of the page</p>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
