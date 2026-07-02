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
                      {/* EĞER BU YAVRU ALANA KIRMIZI NOKTA EKLENMİŞSE ONLARI ÇİZ */}
                      {/* NOT: SVG'de drop-shadow filtresi çok ağır → kaldırıldı, nokta rengi koyulaştırıldı */}
                      {child.redDots && child.redDots.map((dot, i) => (
                         <circle 
                           key={`reddot-${child.id}-${i}`}
                           cx={dot.x} 
                           cy={dot.y} 
                           r="0.28" 
                           fill={selectedChildId === child.id ? '#ff6666' : '#ff3333'}
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
                overflowY: 'auto'
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

          {selectedMainAreaId ? (
            <div style={styles.detailsCard}>
              <h2 style={{ color: '#c7a15b', marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                {mainAreas.find(a => a.id === selectedMainAreaId)?.name}
              </h2>
              <p style={{ color: '#e6e6e6', lineHeight: '1.6', fontSize: '14px' }}>
                Bu alanda {currentChildren.length} adet yavru kelime haritalanmış.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
                {currentChildren.map((c, i) => (
                  <div key={c.id} style={{ padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '6px', fontSize: '13px', color: '#00ffff', cursor: 'pointer', transition: 'background-color 0.2s' }} 
                       onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                       onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                       onClick={() => setSelectedChildId(c.id)}>
                    Kelime {i + 1}: {c.latinText ? c.latinText.substring(0, 15) + "..." : "Tanımsız"}
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
                // Elle girilmiş paragraf varsa onu göster
                if (area?.paragraph && area.paragraph.trim()) {
                  return area.paragraph;
                }
                // Yoksa yavru alanların latinText'lerini otomatik birleştir
                const autoText = childAreas
                  .filter(c => c.mainAreaId === fullTextModalAreaId)
                  .map(c => c.latinText)
                  .filter(t => t)
                  .join(' ');
                if (autoText) return autoText;
                return (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>
                    Bu alana henüz metin girilmemiş. Haritalama modundan paragraf ekleyebilirsiniz.
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
                 textAlign: 'center', fontWeight: 'bold', lineHeight: '1.6', maxWidth: '800px'
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
  }
};
