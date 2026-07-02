import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const MinimalistMainPoint = ({ area, isSelected, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: `${area.mainPoint.top}%`,
        right: `${area.mainPoint.right}%`,
        zIndex: isHovered || isSelected ? 70 : 55, // zIndex artırıldı (svgOverlay 45'in üzerinde kalması için)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { 
        e.stopPropagation(); 
        onSelect(isSelected ? null : area.id); // Tekrar tıklanınca kapansın (Toggle)
      }}
    >
      {isHovered && !isSelected && (
        <div style={{
          position: 'absolute',
          bottom: '25px',
          right: '25px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          border: '2px solid rgba(0, 255, 255, 0.7)',
          boxShadow: '0 15px 35px rgba(0,0,0,0.9), inset 0 0 15px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 100,
          backgroundColor: '#000'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/resim.png)', 
            backgroundSize: '1000%',
            backgroundPosition: `right ${area.mainPoint.right}% top ${area.mainPoint.top}%`,
            backgroundRepeat: 'no-repeat',
            filter: 'contrast(1.1) brightness(1.1)'
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: 'rgba(0, 255, 255, 0.9)', fontSize: '24px', fontWeight: '200'
          }}>+</div>
        </div>
      )}

      <div style={{
        width: isHovered || isSelected ? '22px' : '8px',
        height: isHovered || isSelected ? '22px' : '8px',
        borderRadius: '50%',
        border: `1.5px solid ${isSelected ? '#c7a15b' : 'rgba(0, 255, 255, 0.7)'}`,
        backgroundColor: isSelected ? 'rgba(199, 161, 91, 0.15)' : (isHovered ? 'rgba(0, 255, 255, 0.15)' : 'transparent'),
        transform: 'translate(12px, -12px)',
        transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 15px rgba(199, 161, 91, 0.5)' : 'none'
      }}>
        {isSelected && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '6px', height: '6px', backgroundColor: '#c7a15b', borderRadius: '50%'
          }} />
        )}
      </div>
    </div>
  );
};

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
  const [readChildIds, setReadChildIds] = useState(new Set());
  const [previousZoomLevel, setPreviousZoomLevel] = useState(null);
  const [fullTextModalAreaId, setFullTextModalAreaId] = useState(null);
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

          if (selectedMainAreaId) {
            const area = mainAreas.find(a => a.id === selectedMainAreaId);
            if (area) {
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
    loadData();
    
    // Mobil görünüm için ekran boyutunu dinle (Tabletleri de kapsamak için 1024px)
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activePageId]);

  const loadData = async () => {
    try {
      const p = await api.getPage(activePageId);
      setPage(p);
      const mAreas = await api.getMainAreas(activePageId);
      setMainAreas(mAreas);
      const cAreas = await api.getAllChildAreasForPage(activePageId);
      setChildAreas(cAreas);
    } catch (err) {
      console.error("Yükleme hatası", err);
    }
  };

  const handleBackgroundClick = (e) => {
    if (e.target.tagName.toLowerCase() === 'img') {
      if (selectedChildId) {
        setSelectedChildId(null);
        if (previousZoomLevel) {
          handleZoom(previousZoomLevel - zoomLevel);
          setPreviousZoomLevel(null);
        }
      } else {
        setSelectedMainAreaId(null);
        setPreviousZoomLevel(null);
      }
    }
  };

  const currentChildren = childAreas.filter(c => c.mainAreaId === selectedMainAreaId);

  if (!page) return <div style={{color:'white', padding: '20px'}}>Yükleniyor...</div>;

  // MOBİL VE MASAÜSTÜ ORTAK YAPI (KIRMIZI ELMA)
  // Sadece sağ taraftaki detay paneli mobilde gizlenir.
  return (
    <div style={styles.mainLayout}>
      
      {/* SOL: DEVASA RESİM ALANI (Mobilde Tam Ekran) */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', backgroundColor: '#111' }}>
        
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
            setReadChildIds(new Set());
          }} style={{ ...styles.zoomBtn, fontSize: '14px', width: 'auto', padding: '0 10px', borderRadius: '4px' }}>
             👁️ Genel
          </button>
        </div>

        {/* MOBİL SAYFA GEÇİŞ KONTROLLERİ (Sadece mobilde resmin üzerinde yüzer) */}
        {isMobile && (
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: '5px 15px', borderRadius: '8px', border: '1px solid #c7a15b', gap: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>
            <button onClick={() => navigate(`/overview/${Math.max(1, activePageId - 1)}`)} style={{...styles.pageBtn, padding: '5px 15px', fontSize: '16px'}}>&lt;</button>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap' }}>Sayfa {activePageId} / 110</span>
            <button onClick={() => navigate(`/overview/${Math.min(110, activePageId + 1)}`)} style={{...styles.pageBtn, padding: '5px 15px', fontSize: '16px'}}>&gt;</button>
          </div>
        )}

        {/* SCROLL EDİLEBİLİR ALAN */}
        <div ref={scrollContainerRef} style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex' }}>
          <div style={{ ...styles.imageContainer, margin: 'auto' }} onClick={handleBackgroundClick}>
            <img 
              src={page.imageUrl} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/resim.jpg"; }}
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
                  zIndex: isSelected ? 60 : 1,
                  transformOrigin: `${100 - parseFloat(area.mainPoint.right)}% ${area.mainPoint.top}%`,
                  // Ana alan büyütme oranını mobilde bir tık artırdık
                  transform: isSelected ? `scale(${isMobile ? 1.25 : 1.15}) translateY(-5px)` : 'scale(1)',
                  opacity: isSelected ? 1 : 0,
                  filter: 'drop-shadow(0px 30px 40px rgba(0,0,0,1)) drop-shadow(0px 0px 20px rgba(199, 161, 91, 0.8))',
                  transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {/* Kesilmiş Resim */}
                <img 
                  src={page.imageUrl}
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
                    fill="rgba(199, 161, 91, 0.15)"
                    stroke="#c7a15b"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Seçiliyse İçindeki Yavru Alanların Çerçevesi */}
                  {isSelected && currentChildren.map((child) => (
                    <polygon 
                      key={`popout-child-${child.id}`}
                      points={child.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ')}
                      fill={
                        hoveredChildId === child.id ? "rgba(0, 255, 255, 0.25)" :
                        selectedChildId === child.id ? "rgba(0, 255, 255, 0.20)" : 
                        readChildIds.has(child.id) ? "rgba(0, 255, 255, 0.08)" : 
                        "transparent"
                      } 
                      stroke="#00ffff"
                      strokeWidth="0.5"
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'all 0.3s ease' }}
                      onMouseEnter={() => !isMobile && setHoveredChildId(child.id)}
                      onMouseLeave={() => !isMobile && setHoveredChildId(null)}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!selectedChildId) setPreviousZoomLevel(zoomLevel);
                        setSelectedChildId(child.id); 
                        setZoomLevel(0.70);
                        setReadChildIds(prev => new Set(prev).add(child.id));
                      }}
                    />
                  ))}
                </svg>

                {/* Ana Alan Tam Metin İkonu (Sadece Seçiliyken ve Ana Alanla Birlikte Büyür) */}
                {isSelected && (() => {
                  const pointX = 100 - parseFloat(area.mainPoint.right);
                  const pointY = parseFloat(area.mainPoint.top);
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${pointY}%`,
                        left: `${pointX}%`,
                        transform: 'translate(-50%, -50%) translate(-30px, 0px)', // Merkez noktasının (altın noktanın) hemen soluna oturt
                        zIndex: 10, 
                        pointerEvents: 'auto',
                        opacity: 0.9,
                        cursor: 'pointer',
                        backgroundColor: 'rgba(15, 15, 15, 0.95)',
                        border: '1px solid #00ffff',
                        color: '#00ffff',
                        borderRadius: '50%',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 5px 20px rgba(0,0,0,0.8)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = 'translate(-50%, -50%) translate(-30px, 0px) scale(1.15)'; 
                        e.currentTarget.style.backgroundColor = '#00ffff'; 
                        e.currentTarget.style.color = '#000'; 
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = 'translate(-50%, -50%) translate(-30px, 0px) scale(1)'; 
                        e.currentTarget.style.backgroundColor = 'rgba(15, 15, 15, 0.95)'; 
                        e.currentTarget.style.color = '#00ffff'; 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullTextModalAreaId(area.id);
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                  );
                })()}
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

          {/* Ana Alan Noktaları */}
          {mainAreas.map((area) => (
            <MinimalistMainPoint 
              key={`point-${area.id}`} 
              area={area} 
              isSelected={selectedMainAreaId === area.id} 
              onSelect={setSelectedMainAreaId} 
            />
          ))}

          {/* Yavru Alan Noktaları */}
          {currentChildren.map((child) => (
            <div key={`cpoint-${child.id}`} style={{ position: 'absolute', top: `${child.mainPoint.top}%`, right: `${child.mainPoint.right}%`, width: '8px', height: '8px', backgroundColor: '#00ffff', borderRadius: '50%', transform: 'translate(50%, -50%)', zIndex: 30, pointerEvents: 'none' }} />
          ))}

          {/* YAVRU ALAN ÖZEL EFEKTLİ GÖSTERİMİ */}
          {selectedChildId && childAreas.filter(c => c.id === selectedChildId).map(child => {
            const childX = 100 - parseFloat(child.mainPoint.right);
            const childY = parseFloat(child.mainPoint.top);
            const clipPathStr = `polygon(${child.points.map(p => `${100 - parseFloat(p.right)}% ${p.top}%`).join(', ')})`;
            
            // Poligonun Bounding Box'ı
            const rightValues = child.points.map(p => 100 - parseFloat(p.right));
            const topValues = child.points.map(p => parseFloat(p.top));
            const minX = Math.min(...rightValues);
            const maxX = Math.max(...rightValues);
            const minY = Math.min(...topValues);
            const maxY = Math.max(...topValues);
            
            // Hangi yönde daha çok boşluk var? (Kutuyu en uygun yere yerleştirmek için)
            const spaceTop = minY;
            const spaceBottom = 100 - maxY;
            const spaceLeft = minX;
            const spaceRight = 100 - maxX;
            
            const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
            
            let placement = 'bottom';
            if (isMobile) {
              // Mobilde yatay alan çok dar olduğu için kutuyu sağa/sola KOYMA. Sadece alt veya üst.
              placement = spaceTop > spaceBottom ? 'top' : 'bottom';
            } else {
              if (maxSpace === spaceTop) placement = 'top';
              else if (maxSpace === spaceBottom) placement = 'bottom';
              else if (maxSpace === spaceLeft) placement = 'left';
              else if (maxSpace === spaceRight) placement = 'right';
            }

            const padding = 3; 
            // Kutuyu her zaman kelimenin yatay merkezine sabitle. 
            // Çünkü zoomInPlace animasyonu zaten kelimeyi ekranın ortasına taşıyor, böylece kutu da otomatik olarak ekranın ortasına gelir!
            let modalX = childX;
            let modalY = childY;
            let boxTransform = '';

            if (placement === 'top') {
              modalY = minY - padding;
              boxTransform = 'translate(-50%, -100%)';
            } else if (placement === 'bottom') {
              modalY = maxY + padding;
              boxTransform = 'translate(-50%, 0)';
            } else if (placement === 'left') {
              modalX = minX - padding;
              boxTransform = 'translate(-100%, -50%)';
            } else if (placement === 'right') {
              modalX = maxX + padding;
              boxTransform = 'translate(0, -50%)';
            }

            // Ekran Taşmasını Engellemek İçin Dinamik Kaydırma (Shift) Hesaplaması
            const scale = isMobile ? 1.50 : 2.5; // Mobilde Arapça kelimeyi biraz daha okunaklı yapmak için 1.50'ye çıkardık
            
            // 1. Sadece Arapça Kelimenin Sınırları (Öncelikli koruyacağımız alan)
            let wordMinX = childX + (minX - childX) * scale;
            let wordMaxX = childX + (maxX - childX) * scale;
            let wordMinY = childY + (minY - childY) * scale;
            let wordMaxY = childY + (maxY - childY) * scale;
            
            // Kutunun merkezinin yaklaştırdıktan sonraki koordinatları
            let zoomedModalX = childX + (modalX - childX) * scale;
            let zoomedModalY = childY + (modalY - childY) * scale;

            // 2. Latince Kutunun Boyut Tahmini (Metin uzunluğuna göre dinamik)
            const textLen = child.latinText ? child.latinText.length : 0;
            
            // Dinamik Font Büyüklüğü (Metin uzadıkça küçülerek ekrana sığmayı garantiler)
            let dynamicFontSize = isMobile ? '12.5px' : '9px'; // Mobilde yazıları %25 daha büyüttük
            let dynamicLineHeight = '1.6';
            let lineH = 4.5; // Kutu yüksekliği tahmini için satır çarpanı
            
            if (textLen > 150) {
              dynamicFontSize = isMobile ? '10px' : '5.5px'; // Eskiden 8px'di
              dynamicLineHeight = '1.35';
              lineH = 2.5;
            } else if (textLen > 100) {
              dynamicFontSize = isMobile ? '11px' : '6.5px'; // Eskiden 8.5px'di
              dynamicLineHeight = '1.4';
              lineH = 3.0;
            } else if (textLen > 60) {
              dynamicFontSize = isMobile ? '11.5px' : '7.5px'; // Eskiden 9px'di
              dynamicLineHeight = '1.5';
              lineH = 3.6;
            }

            // Yükseklik ve Genişlik tahmini
            const estimatedLines = Math.max(1, Math.ceil(textLen / 55));
            const boxH = estimatedLines * lineH + 6; 
            const boxW = isMobile ? 90 : 80; // Mobilde genişliği merkeze sabitlediğimiz için 90 kullanabiliriz

            // 3. Toplam Alan Sınırları (Arapça kelime + Latince Kutu)
            let totalMinX = wordMinX;
            let totalMaxX = wordMaxX;
            let totalMinY = wordMinY;
            let totalMaxY = wordMaxY;

            if (placement === 'top') {
              totalMinY = Math.min(totalMinY, zoomedModalY - boxH);
              totalMinX = Math.min(totalMinX, zoomedModalX - boxW / 2);
              totalMaxX = Math.max(totalMaxX, zoomedModalX + boxW / 2);
            } else if (placement === 'bottom') {
              totalMaxY = Math.max(totalMaxY, zoomedModalY + boxH);
              totalMinX = Math.min(totalMinX, zoomedModalX - boxW / 2);
              totalMaxX = Math.max(totalMaxX, zoomedModalX + boxW / 2);
            } else if (placement === 'left') {
              totalMinX = Math.min(totalMinX, zoomedModalX - boxW);
              totalMinY = Math.min(totalMinY, zoomedModalY - boxH / 2);
              totalMaxY = Math.max(totalMaxY, zoomedModalY + boxH / 2);
            } else if (placement === 'right') {
              totalMaxX = Math.max(totalMaxX, zoomedModalX + boxW);
              totalMinY = Math.min(totalMinY, zoomedModalY - boxH / 2);
              totalMaxY = Math.max(totalMaxY, zoomedModalY + boxH / 2);
            }

            let shiftX = 0;
            let shiftY = 0;
            const safePadding = 2; // Ekranda %2'lik güvenlik boşluğu
            
            // A) Önce tüm alanı (Kelime + Kutu) ekrana sığdırmaya çalış
            if (totalMinX < safePadding) shiftX = safePadding - totalMinX;
            else if (totalMaxX > 100 - safePadding) shiftX = (100 - safePadding) - totalMaxX;
            
            if (totalMinY < safePadding) shiftY = safePadding - totalMinY;
            else if (totalMaxY > 100 - safePadding) shiftY = (100 - safePadding) - totalMaxY;

            // B) KRİTİK KONTROL: Eğer tüm alanı sığdırmak için yaptığımız kaydırma, 
            // Arapça kelimeyi ekrandan dışarı ittiyse, KAYDIRMAYI İPTAL ET ve Arapça kelimeyi koru!
            if (wordMaxY + shiftY > 100 - safePadding) {
                shiftY = (100 - safePadding) - wordMaxY; // Sadece Arapça kelimeyi sığdıracak kadar kaydır
            }
            if (wordMinY + shiftY < safePadding) {
                shiftY = safePadding - wordMinY;
            }
            if (wordMaxX + shiftX > 100 - safePadding) {
                shiftX = (100 - safePadding) - wordMaxX;
            }
            if (wordMinX + shiftX < safePadding) {
                shiftX = safePadding - wordMinX;
            }

            return (
              <div key={`child-modal-${child.id}`} style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 100, pointerEvents: 'auto',
              }}>
                {/* KARARTMA ARKA PLANI */}
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedChildId(null); 
                    if (previousZoomLevel) {
                        handleZoom(previousZoomLevel - zoomLevel);
                        setPreviousZoomLevel(null);
                    }
                  }}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)',
                    cursor: 'pointer'
                  }} 
                />

                {/* OLDUĞU YERDE BÜYÜYEN VE TAŞMAMASI İÇİN KAYAN PARÇA */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none',
                    transformOrigin: `${childX}% ${childY}%`,
                    animation: `zoomInPlace-${child.id} 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
                }}>
                   <style>
                     {`
                       @keyframes zoomInPlace-${child.id} {
                         from { transform: translate(0%, 0%) scale(1); }
                         to { transform: translate(${shiftX}%, ${shiftY}%) scale(${scale}); }
                       }
                       @keyframes fadeInText-${child.id} {
                         0% { opacity: 0; transform: ${boxTransform} scale(0.9); }
                         100% { opacity: 1; transform: ${boxTransform} scale(1); }
                       }
                     `}
                   </style>

                   {/* Arka Plandaki Ok Çizgisi */}
                   <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
                      <line 
                        x1={childX} y1={childY} 
                        x2={modalX} y2={modalY} 
                        stroke="#00ffff" strokeWidth="0.5" strokeDasharray="1.5,1.5" 
                        vectorEffect="non-scaling-stroke"
                      />
                   </svg>

                   {/* Kesik Resim */}
                   <img src={page.imageUrl} style={{ ...styles.image, height: `${zoomLevel * 92}vh`, maxHeight: 'none', maxWidth: 'none', position: 'absolute', top: 0, left: 0, clipPath: clipPathStr, zIndex: 2 }} />
                   
                   {/* Öndeki Çerçeve */}
                   <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}>
                      <polygon 
                        points={child.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ')}
                        fill="transparent" stroke="#00ffff" strokeWidth="0.5" vectorEffect="non-scaling-stroke"
                      />
                   </svg>

                   {/* Yanındaki Tematik Latince Kutu */}
                   <div style={{
                     position: 'absolute',
                     left: `${modalX}%`,
                     top: `${modalY}%`,
                     backgroundColor: 'rgba(15, 15, 15, 0.95)',
                     border: '1px solid #00ffff',
                     color: '#ffffff',
                     padding: '10px 12px',
                     borderRadius: '4px',
                     fontSize: dynamicFontSize,
                     lineHeight: dynamicLineHeight,
                     fontWeight: 'normal',
                     boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                     whiteSpace: 'normal',
                     width: 'max-content',
                     maxWidth: isMobile ? `${85 / scale}vw` : '35%', // Scale etkisiyle ekranı taşmaması için ters orantı
                     textAlign: 'center',
                     animation: `fadeInText-${child.id} 0.8s ease forwards`,
                     opacity: 0,
                     pointerEvents: 'auto',
                   }}>
                     {child.latinText || "Latince girilmemiş"}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
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
              {childAreas
                .filter(c => c.mainAreaId === fullTextModalAreaId)
                .map(c => c.latinText)
                .filter(text => text)
                .join(' ')}
              {childAreas.filter(c => c.mainAreaId === fullTextModalAreaId && c.latinText).length === 0 && (
                <span style={{ color: '#888', fontStyle: 'italic' }}>Bu alanda henüz hiçbir kelimenin Latince okunuşu girilmemiş.</span>
              )}
            </div>
          </div>
        </div>
      )}

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
