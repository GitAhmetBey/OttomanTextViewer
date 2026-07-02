import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import MapperMode from './pages/MapperMode';
import OverviewMode from './pages/OverviewMode';

function Navigation() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) return null;

  const isOverview = location.pathname.startsWith('/overview') || location.pathname === '/';
  
  return (
    <nav style={styles.nav}>
      <h1 style={{ margin: 0, fontSize: '20px', color: '#c7a15b' }}>Osmanlıca Oku</h1>
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link 
          to="/overview/1" 
          style={{ ...styles.link, borderBottom: isOverview ? '2px solid #c7a15b' : 'none', color: isOverview ? '#c7a15b' : '#aaa' }}
        >
          👁️ Okuyucu (Overview)
        </Link>
        <Link 
          to="/mapper/1" 
          style={{ ...styles.link, borderBottom: !isOverview ? '2px solid #00ccff' : 'none', color: !isOverview ? '#00ccff' : '#aaa' }}
        >
          ✍️ Haritalama (Create/Edit)
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
        <Navigation />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Routes>
            <Route path="/" element={<OverviewMode />} />
            <Route path="/overview/:pageId" element={<OverviewMode />} />
            <Route path="/mapper/:pageId" element={<MapperMode />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

const styles = {
  nav: {
    backgroundColor: '#1a1a1a',
    padding: '15px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333'
  },
  link: {
    textDecoration: 'none',
    fontWeight: 'bold',
    paddingBottom: '5px',
    transition: 'all 0.2s'
  }
};
