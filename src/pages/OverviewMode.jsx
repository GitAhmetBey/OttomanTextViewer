import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function OverviewMode() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const activePageId = Number(pageId || 1);

  const [page, setPage] = useState(null);
  const [mainAreas, setMainAreas] = useState([]);
  const [childAreas, setChildAreas] = useState([]);
  const [selectedMainAreaId, setSelectedMainAreaId] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [hoveredChildId, setHoveredChildId] = useState(null);
  const [previousZoomLevel, setPreviousZoomLevel] = useState(null);
  const [fullTextModalAreaId, setFullTextModalAreaId] = useState(null);
  const [fullScreenChildId, setFullScreenChildId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [zoomLevel, setZoomLevel] = useState(window.innerWidth <= 1024 ? 0.7 : 1);
  const scrollContainerRef = useRef(null);

  const effectiveSequence = useMemo(() => {
    if (!page || !mainAreas || !childAreas) return [];
    
    let currentSeq = page.readingSequence ? [...page.readingSequence] : [];
    
    mainAreas.forEach(m => {
      if (!currentSeq.find(s => s.type === 'main' && s.id === m.id)) {
        currentSeq.push({ id: m.id, type: 'main' });
      }
    });
    
    childAreas.forEach(c => {
      if (!currentSeq.find(s => s.type === 'child' && s.id === c.id)) {
        currentSeq.push({ id: c.id, type: 'child' });
      }
    });
    
    currentSeq = currentSeq.filter(s => {
      if (s.type === 'main') return mainAreas.find(m => m.id === s.id);
      if (s.type === 'child') return childAreas.find(c => c.id === s.id);
      return false;
    });
    
    if (!page.readingSequence || page.readingSequence.length === 0) {
      const defaultSeq = [];
      mainAreas.forEach(m => {
        defaultSeq.push({ id: m.id, type: 'main' });
        childAreas.filter(c => c.mainAreaId === m.id).forEach(c => {
          defaultSeq.push({ id: c.id, type: 'child' });
        });
      });
      return defaultSeq;
    }
    
    return currentSeq;
  }, [page, mainAreas, childAreas]);

  const currentSequenceIndex = useMemo(() => {
    if (selectedChildId) {
      return effectiveSequence.findIndex(s => s.type === 'child' && s.id === selectedChildId);
    }
    if (selectedMainAreaId) {
      return effectiveSequence.findIndex(s => s.type === 'main' && s.id === selectedMainAreaId);
    }
    return -1;
  }, [selectedChildId, selectedMainAreaId, effectiveSequence]);

  const focusOnTarget = useCallback((mainId, childId) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const img = container.querySelector('img');
    if (!img) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        let pctX = 0.5;
        let pctY = 0.5;

        if (childId) {
          const child = childAreas.find(c => c.id === childId);
          if (child && child.mainPoint) {
            pctX = (100 - parseFloat(child.mainPoint.right)) / 100;
            pctY = parseFloat(child.mainPoint.top) / 100;
          }
        } else if (mainId) {
          const area = mainAreas.find(a => a.id === mainId);
          if (area && area.mainPoint) {
            pctX = (100 - parseFloat(area.mainPoint.right)) / 100;
            pctY = parseFloat(area.mainPoint.top) / 100;
          }
        } else {
           return; 
        }

        const newImgWidth = img.clientWidth;
        const newImgHeight = img.clientHeight;
        const targetScrollLeft = (newImgWidth * pctX) - container.clientWidth / 2;
        const targetScrollTop = (newImgHeight * pctY) - container.clientHeight / 2;

        container.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }, 50); 
    });
  }, [childAreas, mainAreas]);

  useEffect(() => {
    if (selectedChildId || selectedMainAreaId) {
      focusOnTarget(selectedMainAreaId, selectedChildId);
    }
  }, [selectedChildId, selectedMainAreaId, focusOnTarget]);

  const goToSequenceIndex = useCallback((index) => {
    if (index < 0 || index >= effectiveSequence.length) return;
    const item = effectiveSequence[index];
    
    let newMainAreaId = null;
    let newChildId = null;
    
    if (item.type === 'main') {
      newMainAreaId = item.id;
    } else {
      const c = childAreas.find(child => child.id === item.id);
      if (c) {
        newMainAreaId = c.mainAreaId;
        newChildId = c.id;
      }
    }

    if (newMainAreaId !== selectedMainAreaId && selectedMainAreaId !== null) {
      // Geçiş Efekti: Sadece seçimi kaldır (Genel görünüme geçer gibi aydınlat)
      setSelectedMainAreaId(null);
      setSelectedChildId(null);
      
      // Biraz bekle, sonra yeni ana alana git ve merkezine kay (Zoom değiştirmeden)
      setTimeout(() => {
        setSelectedMainAreaId(newMainAreaId);
        setSelectedChildId(newChildId);
      }, 800); 
      return;
    }
    
    // Aynı ana alan içindeysek veya genel görünümden geliyorsak direkt git
    setSelectedMainAreaId(newMainAreaId);
    setSelectedChildId(newChildId);
  }, [effectiveSequence, childAreas, selectedMainAreaId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentSequenceIndex !== -1) {
        if (e.key === 'ArrowRight') {
          goToSequenceIndex(currentSequenceIndex + 1);
        } else if (e.key === 'ArrowLeft') {
          goToSequenceIndex(currentSequenceIndex - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSequenceIndex, goToSequenceIndex]);


  const handleZoom = (delta) => {
    setZoomLevel(prevZoom => {
      let newZoom = prevZoom + delta;
      newZoom = Math.max(0.5, Math.min(5, newZoom));
      if (newZoom === prevZoom) return prevZoom;

      const container = scrollContainerRef.current;
      if (container) {
        const img = container.querySelector('img');
        if (img) {
          let pctX = 0.5;
          let pctY = 0.5;

          if (selectedChildId) {
            const child = childAreas.find(c => c.id === selectedChildId);
            if (child && child.mainPoint) {
              pctX = (100 - parseFloat(child.mainPoint.right)) / 100;
              pctY = parseFloat(child.mainPoint.top) / 100;
            }
          } else if (selectedMainAreaId) {
            const area = mainAreas.find(a => a.id === selectedMainAreaId);
            if (area && area.mainPoint) {
              pctX = (100 - parseFloat(area.mainPoint.right)) / 100;
              pctY = parseFloat(area.mainPoint.top) / 100;
            }
          } else {
            const imgRect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const viewportCenterX = containerRect.left + container.clientWidth / 2;
            const viewportCenterY = containerRect.top + container.clientHeight / 2;
            pctX = (viewportCenterX - imgRect.left) / imgRect.width;
            pctY = (viewportCenterY - imgRect.top) / imgRect.height;
          }

          requestAnimationFrame(() => {
            setTimeout(() => {
              if (scrollContainerRef.current) {
                const newImgWidth = img.clientWidth;
                const newImgHeight = img.clientHeight;
                scrollContainerRef.current.scrollLeft = (newImgWidth * pctX) - scrollContainerRef.current.clientWidth / 2;
                scrollContainerRef.current.scrollTop = (newImgHeight * pctY) - scrollContainerRef.current.clientHeight / 2;
              }
            }, 10);
          });
        }
      }
      return newZoom;
    });
  };

  useEffect(() => {
    // Sayfa değiştiğinde tüm seçimleri ve yakınlaştırmayı (zoom) sıfırla (Genel görünüme dön)
    setSelectedMainAreaId(null);
    setSelectedChildId(null);
    setPreviousZoomLevel(null);
    setZoomLevel(isMobile ? 0.7 : 1);
    setFullScreenChildId(null);
    setFullTextModalAreaId(null);

    // Sayfa verisi (tek seferlik - sayfa resmi değişmediği için yeterli)
    api.getPage(activePageId).then(p => setPage(p)).catch(console.error);

    // ── GERÇEk ZAMANLI DİNLEYİCİLER ──────────────────────────────────────
    // Ana alanlar değişince (paragraf güncelleme, yeni alan vb.) anında yansı
    const unsubMain = api.subscribeToMainAreas(activePageId, (areas) => {
      setMainAreas(areas);
    });

    // Yavru alanlar değişince anında yansı
    const unsubChildren = api.subscribeToChildAreasForPage(activePageId, (children) => {
      setChildAreas(children);
    });

    // Mobil görünüm için ekran boyutunu dinle
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);

    // Bileşen ekrandan kalkınca dinleyicileri durdur (bellek sızıntısı önlenir)
    return () => {
      unsubMain();
      unsubChildren();
      window.removeEventListener('resize', handleResize);
    };
  }, [activePageId]);

  const handleBackgroundClick = (e) => {
    if (e.target.tagName.toLowerCase() === 'img') {
      // Arka plana (resme) tıklandığında hem yavru (Latince) kutuyu hem de ana alan zoom'unu kapat
      setSelectedChildId(null);
      setSelectedMainAreaId(null);
      setPreviousZoomLevel(null);
    }
  };

  // useMemo: selectedMainAreaId değişmediği sürece filtreyi yeniden hesaplama
  const currentChildren = useMemo(
    () => childAreas.filter(c => c.mainAreaId === selectedMainAreaId),
    [childAreas, selectedMainAreaId]
  );

  if (!page) return <div style={{color:'white', padding: '20px'}}>Yükleniyor...</div>;

  // MOBİL VE MASAÜSTÜ ORTAK YAPI (KIRMIZI ELMA)
  // Sadece sağ taraftaki detay paneli mobilde gizlenir.
  return (
    <div style={styles.mainLayout}>
      
      {/* SOL: DEVASA RESİM ALANI (Mobilde Tam Ekran) */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', backgroundColor: '#111', display: 'flex', flexDirection: 'column' }}>
        
        {/* ZOOM KONTROLLERİ */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 9999, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: '5px 10px', borderRadius: '8px', border: '1px solid #444', gap: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
          <button onClick={() => handleZoom(-0.03)} style={styles.zoomBtn}>-</button>
          <span style={{ color: '#00ffff', fontSize: '14px', fontWeight: 'bold', width: '45px', textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => handleZoom(0.03)} style={styles.zoomBtn}>+</button>
          
          {/* SIFIRLA BUTONU */}
          <button onClick={() => {
            setZoomLevel(isMobile ? 0.7 : 1);
            setSelectedMainAreaId(null);
            setSelectedChildId(null);
            setPreviousZoomLevel(null);
          }} style={{ ...styles.zoomBtn, fontSize: '14px', width: 'auto', padding: '0 10px', borderRadius: '4px' }}>
             👁️ Genel
          </button>
        </div>

        {/* MOBİL SAYFA GEÇİŞ KONTROLLERİ (Sadece mobilde resmin üzerinde yüzer) */}
        {isMobile && !selectedChildId && (
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: '5px 15px', borderRadius: '8px', border: '1px solid #c7a15b', gap: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>
            <button onClick={() => navigate(`/overview/${Math.max(1, activePageId - 1)}`)} style={{...styles.pageBtn, padding: '5px 15px', fontSize: '16px'}}>&lt;</button>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap' }}>Sayfa {activePageId} / 110</span>
            <button onClick={() => navigate(`/overview/${Math.min(110, activePageId + 1)}`)} style={{...styles.pageBtn, padding: '5px 15px', fontSize: '16px'}}>&gt;</button>
          </div>
        )}

        {/* MOBİL SLAYT BAŞLATMA BUTONU */}
        {isMobile && !selectedChildId && !selectedMainAreaId && effectiveSequence.length > 0 && (
          <div 
             onClick={() => goToSequenceIndex(0)}
             style={{ 
               position: 'absolute', bottom: '20px', right: '20px', zIndex: 9999, 
               backgroundColor: '#c7a15b', color: '#000', width: '50px', height: '50px', 
               borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', 
               fontSize: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.8)', cursor: 'pointer',
               border: '2px solid #fff'
             }}
          >
            ▶️
          </div>
        )}

        {/* SCROLL EDİLEBİLİR ALAN */}
        <div ref={scrollContainerRef} style={{ width: '100%', flex: 1, overflow: 'auto', display: 'flex', position: 'relative' }}>
          <div style={{ ...styles.imageContainer, margin: 'auto' }} onClick={handleBackgroundClick}>
            <img 
              src={page.imageUrl} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/resim.png"; }}
              alt="Taş Baskı" 
              style={{ ...styles.image, height: `${zoomLevel * 92}vh`, maxHeight: 'none', maxWidth: 'none' }} 
            />

          {/* KARARTMA KATMANI */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)',
            opacity: selectedMainAreaId ? 1 : 0,
            pointerEvents: 'none',
            transition: 'opacity 0.6s ease',
            zIndex: 5
          }} />

          {/* POP-OUT EFEKTİ (Plakadan Kopan Parça + Birlikte Büyüyen Çerçeveler) */}
          {mainAreas.map(area => {
            const isSelected = selectedMainAreaId === area.id;
            if (!isSelected) return null; // MOBİL PERFORMANS İÇİN: Sadece seçili olan alanı render et!
            
            const clipPathStr = `polygon(${area.points.map(p => `${100 - parseFloat(p.right)}% ${p.top}%`).join(', ')})`;
            return (
              <div 
                key={`popout-wrapper-${area.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none', // wrapper tıklamaları engellemesin, sadece içindeki poligonlar tıklanabilsin
                  zIndex: 60,
                  transformOrigin: `${100 - parseFloat(area.mainPoint.right)}% ${area.mainPoint.top}%`,
                  transform: `scale(${isMobile ? 1.25 : 1.15}) translateY(-5px) translateZ(0)`,
                  opacity: 1,
                  filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.8))', // Çok daha hafif gölge, performansı inanılmaz artırır
                  willChange: 'transform, opacity', // Donanım hızlandırması (GPU) sağlar
                  transition: 'all 0.3s ease-out'
                }}
              >
                {/* Kesilmiş Resim */}
                <img 
                  src={page.imageUrl}
                  onError={(e) => { e.target.onerror = null; e.target.src = "/resim.png"; }}
                  style={{
                    ...styles.image,
                    height: `${zoomLevel * 92}vh`, maxHeight: 'none', maxWidth: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    clipPath: clipPathStr,
                    pointerEvents: 'none'
                  }}
                />
                
                {/* Resimle Birlikte Büyüyen Sınır Çizgileri */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
                  {/* Ana Alanın Kendi Altın Sarısı Çerçevesi */}
                  <polygon 
                    points={area.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ')}
                    fill="transparent"
                    stroke="#c7a15b"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Seçiliyse İçindeki Yavru Alanların Çerçevesi */}
                  {isSelected && currentChildren.map((child) => (
                    <React.Fragment key={`popout-child-group-${child.id}`}>
                      <polygon 
                        key={`popout-child-${child.id}`}
                        points={child.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ')}
                        fill={
                          selectedChildId === child.id ? "rgba(199, 161, 91, 0.15)" : 
                          "transparent"
                        } 
                        stroke="#c7a15b"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'all 0.3s ease' }}
                        onMouseEnter={() => !isMobile && setHoveredChildId(child.id)}
                        onMouseLeave={() => !isMobile && setHoveredChildId(null)}
                        onClick={(e) => { 
                          e.stopPropagation();
                          // startTransition ile state güncellemesini düşük öncelikli yap → donma önlenir
                          setSelectedChildId(child.id); 
                        }}
                      />
                      {/* EĞER BU YAVRU ALANA KIRMIZI NOKTA EKLENMİŞSE VE SEÇİLİYSE ONLARI ÇİZ */}
                      {/* NOT: SVG'de drop-shadow filtresi çok ağır → kaldırıldı, nokta rengi koyulaştırıldı */}
                      {selectedChildId === child.id && child.redDots && child.redDots.map((dot, i) => (
                         <circle 
                           key={`reddot-${child.id}-${i}`}
                           cx={dot.x} 
                           cy={dot.y} 
                           r="0.28" 
                           fill='#ff3333'
                           stroke="rgba(255,100,100,0.4)"
                           strokeWidth="0.15"
                           vectorEffect="non-scaling-stroke"
                           style={{ pointerEvents: 'none' }}
                         />
                      ))}
                    </React.Fragment>
                  ))}
                </svg>

              </div>
            );
          })}
          
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{...styles.svgOverlay, zIndex: 45}}>
            {mainAreas.map((area) => {
              const isSelected = selectedMainAreaId === area.id;
              const pointsStr = area.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ');
              
              return (
                <polygon 
                  key={`mainpoly-${area.id}`}
                  points={pointsStr}
                  style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMainAreaId(isSelected ? null : area.id); // Tıklanan alan zaten açıksa kapat
                    setSelectedChildId(null); // Ana alan değişince veya kapanınca alttaki yavru panelini kapat
                  }}
                  
                  fill={isSelected ? "transparent" : "rgba(0,0,0,0)"}
                  stroke={isSelected ? "transparent" : "transparent"}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  
                  onMouseEnter={(e) => { if (!isSelected) e.target.style.fill = "rgba(199, 161, 91, 0.05)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.target.style.fill = "rgba(0,0,0,0)"; }}
                />
              );
            })}
          </svg>


          {/* Yavru Alan Noktaları */}
          {currentChildren.map((child) => (
            <div key={`cpoint-${child.id}`} style={{ position: 'absolute', top: `${child.mainPoint.top}%`, right: `${child.mainPoint.right}%`, width: '8px', height: '8px', backgroundColor: '#00ffff', borderRadius: '50%', transform: 'translate(50%, -50%)', zIndex: 30, pointerEvents: 'none' }} />
          ))}

          {/* YAVRU KELİME POP-OUT EFEKTİ SİLİNDİ (ANA ALAN BÜYÜTÜLÜYOR) */}
        </div>
        </div>

        {/* Slayt Modu İçin Ana Ekranda Gezinme Butonları (Sağ-Sol) */}
        {currentSequenceIndex > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); goToSequenceIndex(currentSequenceIndex - 1); }}
            style={styles.slideshowNavBtnLeft}
          >❮</button>
        )}
        
        {currentSequenceIndex !== -1 && currentSequenceIndex < effectiveSequence.length - 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); goToSequenceIndex(currentSequenceIndex + 1); }}
            style={styles.slideshowNavBtnRight}
          >❯</button>
        )}

        {/* ELEGANT TAM METİN BUTONU (Sadece Ana Alan Seçiliyken ve Yavru Seçili Değilken Görünür) */}
        {selectedMainAreaId && !selectedChildId && (
          <div 
            style={{
              position: 'fixed',
              bottom: isMobile ? '85px' : '40px', // Mobilde zoom kontrollerinin üstüne çıkması için
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9990,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(15, 15, 15, 0.95)',
              border: '1px solid #c7a15b',
              borderRadius: '30px',
              padding: isMobile ? '10px 18px' : '12px 24px',
              color: '#c7a15b',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(199, 161, 91, 0.2)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap', // Yazının alt alta düşmesini engeller
              fontSize: isMobile ? '14px' : '16px'
            }}
            onMouseEnter={(e) => {
              if (isMobile) return;
              e.currentTarget.style.backgroundColor = '#c7a15b';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (isMobile) return;
              e.currentTarget.style.backgroundColor = 'rgba(15, 15, 15, 0.95)';
              e.currentTarget.style.color = '#c7a15b';
              e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
            }}
            onClick={(e) => {
              e.stopPropagation();
              setFullTextModalAreaId(selectedMainAreaId);
            }}
          >
            <svg width={isMobile ? "16" : "20"} height={isMobile ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Tüm Paragrafı Oku
          </div>
        )}

        {/* ALT: YAVRU KELİME TERCÜME KARTI */}
        {selectedChildId && childAreas.filter(c => c.id === selectedChildId).map(child => {
          return (
            <div key={`bottom-card-${child.id}`} style={{
              width: '100%',
              backgroundColor: '#1a1a1a',
              borderTop: '2px solid #c7a15b',
              padding: '20px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.8)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}>
              <style>
                {`
                  @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                  }
                `}
              </style>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginBottom: '15px', alignItems: 'center' }}>
                <span style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '14px' }}>SEÇİLİ KELİME</span>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <button 
                    onClick={() => handleZoom(-0.25)}
                    style={{ background: 'none', border: 'none', color: '#00ffff', fontSize: '24px', cursor: 'pointer', padding: '0 5px' }}
                    title="Resmi Uzaklaştır (-)"
                  >
                    -
                  </button>
                  <button 
                    onClick={() => handleZoom(0.25)}
                    style={{ background: 'none', border: 'none', color: '#00ffff', fontSize: '24px', cursor: 'pointer', padding: '0 5px' }}
                    title="Resmi Yakınlaştır (+)"
                  >
                    +
                  </button>
                  <button 
                    onClick={() => setFullScreenChildId(child.id)}
                    style={{ background: 'none', border: 'none', color: '#c7a15b', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                    title="Arapçasını Tam Ekran Gör"
                  >
                    🔍
                  </button>
                  <button 
                    onClick={() => setSelectedChildId(null)}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: '0 10px' }}
                  >
                    &times;
                  </button>
                </div>
              </div>

              <div style={{
                color: '#ffffff',
                fontSize: isMobile ? '18px' : '20px',
                lineHeight: '1.6',
                textAlign: 'center',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '30vh',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {child.latinText || "Bu kelimenin latince okunuşu henüz girilmemiş."}
              </div>
            </div>
          );
        })}
      </div>

      {/* SAĞ: DETAY PANELİ (Sadece Masaüstünde Görünür) */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button onClick={() => navigate(`/overview/${Math.max(1, activePageId - 1)}`)} style={styles.pageBtn}>&lt;</button>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>Sayfa {activePageId} / 110</span>
            <button onClick={() => navigate(`/overview/${Math.min(110, activePageId + 1)}`)} style={styles.pageBtn}>&gt;</button>
          </div>

          {effectiveSequence.length > 0 && !selectedMainAreaId && (
            <button 
               onClick={() => goToSequenceIndex(0)}
               style={{ width: '100%', padding: '15px', backgroundColor: '#c7a15b', color: '#000', fontWeight: 'bold', fontSize: '16px', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', transition: 'transform 0.2s' }}
               onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              ▶️ Slaytı (Okumayı) Başlat
            </button>
          )}

          {selectedMainAreaId ? (() => {
            const selectedArea = mainAreas.find(a => a.id === selectedMainAreaId);
            return (
              <div style={styles.detailsCard}>
                <h2 style={{ color: '#c7a15b', marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '15px', fontSize: '16px' }}>
                  ✍️ {selectedArea?.name}
                </h2>

                {/* PARAGRAF GİRİŞ ALANI */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Paragraf Metni
                  </div>
                  <textarea
                    key={selectedMainAreaId} // alan değişince içeriği sıfırla
                    defaultValue={selectedArea?.paragraph || ''}
                    placeholder="Bu ana alana ait paragrafı buraya yazın..."
                    onBlur={async (e) => {
                      const text = e.target.value;
                      try {
                        await api.updateMainArea(selectedMainAreaId, { paragraph: text });
                        // onSnapshot zaten mainAreas'ı güncelleyecek, ekstra setState gerek yok
                      } catch (err) { console.error('Paragraf kaydedilemedi', err); }
                    }}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      minHeight: '160px', padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #c7a15b44',
                      backgroundColor: '#111',
                      color: '#e6e6e6',
                      fontSize: '14px', lineHeight: '1.8',
                      resize: 'vertical', fontFamily: 'inherit',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#c7a15b'}
                    onBlurCapture={e => e.target.style.borderColor = '#c7a15b44'}
                  />
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '5px' }}>
                    💾 Kutunun dışına tıklayınca otomatik kaydedilir
                  </div>
                </div>

                {/* YAVRU KELİMELER LİSTESİ */}
                <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '14px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Yavru Kelimeler ({currentChildren.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentChildren.map((c, i) => (
                      <div key={c.id}
                        style={{ padding: '8px 10px', backgroundColor: '#1e1e1e', borderRadius: '6px', fontSize: '13px', color: '#00ffff', cursor: 'pointer', borderLeft: '2px solid transparent', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2a2a2a'; e.currentTarget.style.borderLeftColor = '#00ffff'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1e1e1e'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
                        onClick={() => setSelectedChildId(c.id)}>
                        {i + 1}. {c.latinText ? c.latinText.substring(0, 20) + (c.latinText.length > 20 ? '…' : '') : <span style={{color:'#555', fontStyle:'italic'}}>boş</span>}
                      </div>
                    ))}
                    {currentChildren.length === 0 && (
                      <span style={{ color: '#444', fontSize: '13px' }}>Bu alana henüz yavru eklenmemiş.</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={styles.emptyCard}>
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>📖</div>
              <h3 style={{ color: '#888', margin: 0 }}>Bir Alan Seçin</h3>
              <p style={{ color: '#555', textAlign: 'center', marginTop: '10px' }}>
                Görüntülemek istediğiniz bölümü resim üzerinden tıklayarak seçin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAM METİN MODALI */}
      {fullTextModalAreaId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setFullTextModalAreaId(null)}>
          <div style={{
            backgroundColor: '#1a1a1a', border: '1px solid #c7a15b',
            borderRadius: '12px', padding: '40px', maxWidth: '700px', width: '90%',
            maxHeight: '80vh', overflowY: 'auto', position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }} onClick={e => e.stopPropagation()}>
            
            <button 
              style={{ 
                position: 'absolute', top: '15px', right: '15px', background: 'none', 
                border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#888'}
              onClick={() => setFullTextModalAreaId(null)}
            >✕</button>
            <h2 style={{ color: '#c7a15b', marginTop: 0, marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Ana Alan Tam Metni
            </h2>
            <div style={{ color: '#e6e6e6', fontSize: '18px', lineHeight: '2', whiteSpace: 'pre-wrap', textAlign: 'justify', textIndent: '20px' }}>
              {(() => {
                const area = mainAreas.find(a => a.id === fullTextModalAreaId);
                // Sadece elle girilmiş paragrafı göster, yavru kelimeleri birleştirme
                if (area?.paragraph && area.paragraph.trim()) {
                  return area.paragraph;
                }
                return (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>
                    Bu alana henüz metin girilmemiş. Haritalama modundan veya sağ menüden paragraf ekleyebilirsiniz.
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAM EKRAN ARAPÇA KELİME GÖRÜNÜMÜ */}
      {fullScreenChildId && childAreas.filter(c => c.id === fullScreenChildId).map(child => {
        const xs = child.points.map(p => 100 - parseFloat(p.right));
        const ys = child.points.map(p => parseFloat(p.top));
        const childX = 100 - parseFloat(child.mainPoint.right);
        const childY = parseFloat(child.mainPoint.top);
        const clipPathStr = `polygon(${child.points.map(p => `${100 - parseFloat(p.right)}% ${p.top}%`).join(', ')})`;
        
        const wordWidthPct = Math.max(...xs) - Math.min(...xs);
        const wordHeightPct = Math.max(...ys) - Math.min(...ys);

        const safeWordWidth = Math.max(wordWidthPct, 1);
        const safeWordHeight = Math.max(wordHeightPct, 1);

        // Genişliğe göre sığdırma (Resim alanının %95'ine sığsın)
        const maxWidthVw = 9500 / safeWordWidth;
        // Yüksekliğe göre sığdırma (Resim alanının yüksekliği 55vh. %50'sine sığsın)
        // Tahmini resim en/boy oranı 1.4 olarak alındı
        const maxWidthVh = 5000 / (1.4 * safeWordHeight);
        
        // CSS min() fonksiyonu ile ekranın neresinden taşıyorsa o sınırı kullanmasını sağlıyoruz.
        const calculatedWidth = `min(${maxWidthVw}vw, ${maxWidthVh}vh, 400vw)`;

        return (
          <div key={`fullscreen-${child.id}`} style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.98)', zIndex: 999999,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflow: 'hidden', cursor: 'pointer'
          }} onClick={() => setFullScreenChildId(null)}>
            
            <button style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '40px', color: '#fff', background: 'none', border: 'none', zIndex: 1000000, cursor: 'pointer' }}>&times;</button>
            
            {/* ÜST KISIM: Arapça Kırpılmış Resim */}
            <div style={{ position: 'relative', width: '100%', height: '55vh', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%' }}>
                     <img 
                       src={page.imageUrl}
                       onError={(e) => { e.target.onerror = null; e.target.src = "/resim.png"; }}
                       alt="Kelime Detayı"
                       style={{
                         position: 'absolute',
                         width: calculatedWidth,
                         maxWidth: 'none',
                         clipPath: clipPathStr,
                         transform: `translate(-${childX}%, -${childY}%) translateZ(0)`,
                         willChange: 'transform',
                         filter: 'drop-shadow(0px 0px 15px rgba(0, 255, 255, 0.4))'
                       }}
                     />
                </div>
            </div>
            
            {/* ALT KISIM: Latince Okunuş */}
            <div style={{ 
              width: '100%', height: '45vh', 
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: '10px 20px 30px 20px', overflowY: 'auto'
            }}>
               <div style={{ 
                 color: '#fff', fontSize: isMobile ? '18px' : '22px', 
                 textAlign: 'center', fontWeight: 'bold', lineHeight: '1.6', maxWidth: '800px',
                 whiteSpace: 'pre-wrap'
               }}>
                   {child.latinText}
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  mainLayout: {
    display: 'flex',
    height: '100%',
    width: '100%',
  },
  imageSection: {
    flex: 1,
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px',
    overflow: 'hidden',
    backgroundColor: '#111'
  },
  imageContainer: {
    position: 'relative',
    display: 'inline-block',
    backgroundColor: '#000',
  },
  image: {
    display: 'block',
    maxHeight: '92vh',
    maxWidth: '100%',
    width: 'auto',
    height: 'auto',
    boxShadow: '0 0 30px rgba(0,0,0,1)'
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 45,
    pointerEvents: 'none'
  },
  sidebar: {
    width: '320px',
    minWidth: '320px',
    backgroundColor: '#1e1e1e',
    borderLeft: '1px solid #333',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflowY: 'auto'
  },
  pageBtn: {
    padding: '5px 15px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  detailsCard: {
    backgroundColor: '#1e1e1e',
    height: '100%',
    boxSizing: 'border-box'
  },
  emptyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '40px',
    border: '1px dashed #333',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '20px'
  },
  zoomBtn: {
    width: '30px',
    height: '30px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'background-color 0.2s'
  },
  slideshowNavBtnLeft: {
    position: 'absolute',
    top: '50%',
    left: '10px',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: 1000001,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  slideshowNavBtnRight: {
    position: 'absolute',
    top: '50%',
    right: '10px',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: 1000001,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s'
  }
};
