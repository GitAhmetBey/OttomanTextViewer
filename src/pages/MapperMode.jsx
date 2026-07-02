import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function MapperMode() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const activePageId = Number(pageId || 1);

  const [page, setPage] = useState(null);
  const [mainAreas, setMainAreas] = useState([]);
  const [childAreas, setChildAreas] = useState([]);
  const [selectedMainAreaId, setSelectedMainAreaId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Çizim state'leri
  const [mousePos, setMousePos] = useState({ clientX: 0, clientY: 0, percentX: 0, percentY: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const [currentMainPoint, setCurrentMainPoint] = useState(null);
  const [currentPolygon, setCurrentPolygon] = useState([]); 
  const [dotModeChildId, setDotModeChildId] = useState(null);
  const [activeChildId, setActiveChildId] = useState(null);

  const imageRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [activePageId]);

  const loadData = async () => {
    try {
      const p = await api.getPage(activePageId);
      setPage(p);
      const mAreas = await api.getMainAreas(activePageId);
      setMainAreas(mAreas);
      
      // Tüm yavru alanları yükle
      const cAreas = await api.getAllChildAreasForPage(activePageId);
      setChildAreas(cAreas);
    } catch (err) {
      console.error("Veri yüklenemedi", err);
    }
  };

  const handleMouseMove = (e) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;
    setMousePos({ clientX: e.clientX, clientY: e.clientY, percentX, percentY });
  };

  const handleImageClick = async () => {
    if (!isHovering) return;
    
    const newPoint = {
      x: mousePos.percentX, 
      y: mousePos.percentY, 
      top: mousePos.percentY.toFixed(2),
      right: (100 - mousePos.percentX).toFixed(2), 
    };

    if (dotModeChildId) {
      const child = childAreas.find(c => c.id === dotModeChildId);
      if (child) {
        const updatedDots = [...(child.redDots || []), newPoint];
        try {
          await api.updateChildArea(child.id, { redDots: updatedDots });
          setChildAreas(childAreas.map(c => c.id === child.id ? { ...c, redDots: updatedDots } : c));
        } catch (e) { console.error(e); }
      }
      return;
    }
    
    if (!currentMainPoint) {
      setCurrentMainPoint(newPoint);
    } else {
      setCurrentPolygon([...currentPolygon, newPoint]);
    }
  };

  const finishPolygon = async () => {
    if (!currentMainPoint || currentPolygon.length < 3) {
      alert("En az 1 ana nokta ve 3 köşe işareti koymalısınız.");
      return;
    }
    
    try {
      if (selectedMainAreaId) {
        // Yavru alan ekleniyor
        const latin = prompt("Bu yavru alanın Latince okunuşunu giriniz:", "");
        if (latin === null) return; // İptal edildi
        
        const newChild = await api.createChildArea({
          mainAreaId: selectedMainAreaId,
          latinText: latin,
          mainPoint: currentMainPoint,
          points: currentPolygon
        });
        setChildAreas([...childAreas, newChild]);
      } else {
        // Ana alan ekleniyor
        const newName = prompt("Bu ana alanın adını giriniz (Örn: Sol Üst Haşiye):", "Yeni Alan");
        if (!newName) return; // İptal edildi
        
        const newMain = await api.createMainArea({
          pageId: activePageId,
          name: newName,
          mainPoint: currentMainPoint,
          points: currentPolygon
        });
        setMainAreas([...mainAreas, newMain]);
      }
      
      setCurrentMainPoint(null);
      setCurrentPolygon([]); 
    } catch (err) {
      alert("Kaydedilirken hata oluştu!");
    }
  };

  const undoLastPoint = () => {
    if (currentPolygon.length > 0) {
      setCurrentPolygon(currentPolygon.slice(0, -1));
    } else if (currentMainPoint) {
      setCurrentMainPoint(null);
    }
  };

  const deleteMainArea = async (id) => {
    if (!window.confirm("Bu ana alanı ve içindeki tüm yavruları silmek istediğinize emin misiniz?")) return;
    await api.deleteMainArea(id);
    // İçindeki yavruları da silmek gerekir (JSON-server otomatik yapmaz cascade yoksa)
    const childrenToDelete = childAreas.filter(c => c.mainAreaId === id);
    for (const c of childrenToDelete) {
       await api.deleteChildArea(c.id);
    }
    if (selectedMainAreaId === id) setSelectedMainAreaId(null);
    loadData();
  };

  const deleteChildArea = async (id) => {
    if (!window.confirm("Bu yavru alanı silmek istediğinize emin misiniz?")) return;
    try {
      await api.deleteChildArea(id);
      loadData();
    } catch (e) {
      console.error("Yavru alan silinemedi:", e);
    }
  };

  const updateChildLatin = (childId, newText) => {
    setChildAreas(childAreas.map(c => c.id === childId ? { ...c, latinText: newText } : c));
  };

  const saveChildLatin = async (childId, newText) => {
    try {
      await api.updateChildArea(childId, { latinText: newText });
    } catch(e) { console.error("Hata", e); }
  };

  const currentChildren = childAreas.filter(c => c.mainAreaId === selectedMainAreaId);

  if (!page) return <div style={{color:'white', padding: '20px'}}>Yükleniyor... (Eğer hata veriyorsa terminalde `npm start` çalıştırdığınızdan emin olun)</div>;

  return (
    <div style={styles.mainLayout}>
      {isHovering && (
        <div style={{ ...styles.floatingTooltip, left: mousePos.clientX + 15, top: mousePos.clientY + 15 }}>
          {!currentMainPoint 
             ? (selectedMainAreaId ? "🎯 Yavru: Merkez Seç" : "🎯 Ana Alan: Merkez Seç") 
             : "🔴 Sınır Çiz"}
        </div>
      )}

      {/* SOL: DEVASA RESİM ALANI */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', backgroundColor: '#111' }}>
        
        {/* ZOOM KONTROLLERİ */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 100, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: '5px 10px', borderRadius: '8px', border: '1px solid #444', gap: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
          <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))} style={styles.zoomBtn}>-</button>
          <span style={{ color: '#00ffff', fontSize: '14px', fontWeight: 'bold', width: '45px', textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel(z => Math.min(5, z + 0.2))} style={styles.zoomBtn}>+</button>
        </div>

        {/* SCROLL EDİLEBİLİR ALAN */}
        <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex' }}>
          <div 
            style={{ ...styles.imageContainer, margin: 'auto' }}
            onMouseMove={handleMouseMove}
            onClick={handleImageClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <img 
              ref={imageRef}
              src={page.imageUrl} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/resim.png"; }}
              alt={`Sayfa ${activePageId}`} 
              style={{ ...styles.image, height: `${zoomLevel * 92}vh`, maxHeight: 'none', maxWidth: 'none' }} 
            />
          
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svgOverlay}>
            {/* ANA ALANLARIN ÇİZİMİ */}
            {mainAreas.map((area) => {
              const isSelected = selectedMainAreaId === area.id;
              const pointsStr = area.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ');
              return (
                <polygon 
                  key={`mainpoly-${area.id}`}
                  points={pointsStr}
                  onClick={(e) => { 
                    if (!isSelected) {
                      e.stopPropagation();
                      document.activeElement?.blur(); // Mobil klavyeyi kapatmak icin
                      setSelectedMainAreaId(area.id);
                      setCurrentMainPoint(null);
                      setCurrentPolygon([]);
                      setDotModeChildId(null);
                      setActiveChildId(null);
                    }
                  }}
                  fill={isSelected ? "rgba(255, 255, 255, 0.05)" : "rgba(0,0,0,0)"}
                  stroke={isSelected ? "#c7a15b" : "rgba(255,255,255,0.4)"}
                  strokeWidth={isSelected ? "3" : "1.5"}
                  strokeDasharray={isSelected ? "none" : "5,5"}
                  vectorEffect="non-scaling-stroke"
                  style={{ 
                    cursor: isSelected ? 'crosshair' : 'pointer', 
                    transition: 'all 0.3s', 
                    pointerEvents: (isSelected || currentPolygon.length > 0) ? 'none' : 'auto' 
                  }}
                />
              );
            })}

            {/* YAVRU ALANLARIN ÇİZİMİ */}
            {currentChildren.map((child) => {
              const isActive = activeChildId === child.id;
              return (
              <polygon 
                key={`childpoly-${child.id}`}
                points={child.points.map(p => `${100 - parseFloat(p.right)},${parseFloat(p.top)}`).join(' ')}
                fill={isActive ? "rgba(255, 204, 0, 0.4)" : "rgba(0, 255, 0, 0.25)"} 
                stroke={isActive ? "#ffcc00" : "#00ff00"}
                strokeWidth={isActive ? "3" : "2"}
                vectorEffect="non-scaling-stroke"
                style={{ transition: 'all 0.2s' }}
              />
              );
            })}

            {/* ŞU AN ÇİZİLEN ŞEKİL */}
            {currentPolygon.length > 0 && (
              <polyline
                points={currentPolygon.map(p => `${p.x},${p.y}`).join(' ') + (isHovering ? ` ${mousePos.percentX},${mousePos.percentY}` : '')}
                fill="rgba(255, 204, 0, 0.15)"
                stroke="#ffcc00"
                strokeWidth="2"
                strokeDasharray="4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* ANA ALAN MERKEZLERİ */}
          {mainAreas.map((area) => (
             <div key={`main-center-${area.id}`} style={{ position: 'absolute', top: `${area.mainPoint.top}%`, left: `${100 - parseFloat(area.mainPoint.right)}%`, width: '12px', height: '12px', backgroundColor: '#c7a15b', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 15, pointerEvents: 'none' }} />
          ))}

          {/* YAVRU ALAN KIRMIZI NOKTALARI */}
          {currentChildren.map(child => (
            child.redDots && child.redDots.map((dot, i) => (
              <div 
                key={`reddot-${child.id}-${i}`} 
                style={{
                  position: 'absolute', top: `${dot.y}%`, left: `${dot.x}%`, width: '4px', height: '4px',
                  backgroundColor: '#ff3333', borderRadius: '50%', transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 8px rgba(255,0,0,0.8)', zIndex: 35,
                  cursor: dotModeChildId === child.id ? 'pointer' : 'default',
                  pointerEvents: dotModeChildId === child.id ? 'auto' : 'none'
                }}
                onClick={async (e) => {
                  if (dotModeChildId === child.id) {
                    e.stopPropagation();
                    const updatedDots = child.redDots.filter((_, idx) => idx !== i);
                    await api.updateChildArea(child.id, { redDots: updatedDots });
                    setChildAreas(childAreas.map(c => c.id === child.id ? { ...c, redDots: updatedDots } : c));
                  }
                }}
              />
            ))
          ))}

          {/* YAVRU ALAN MERKEZLERİ */}
          {currentChildren.map((child, idx) => (
            <div key={`childmain-${child.id}`} style={{ position: 'absolute', top: `${child.mainPoint.top}%`, left: `${100 - parseFloat(child.mainPoint.right)}%`, width: '10px', height: '10px', backgroundColor: '#00ffff', borderRadius: '50%', border: '1px solid #000', transform: 'translate(-50%, -50%)', zIndex: 15, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', color: '#00ffff', fontSize: '10px' }}>{idx + 1}</span>
            </div>
          ))}

          {/* ŞU ANKİ ÇİZİM MERKEZİ */}
          {currentMainPoint && (
            <div style={{ position: 'absolute', top: `${currentMainPoint.y}%`, left: `${currentMainPoint.x}%`, width: '12px', height: '12px', backgroundColor: selectedMainAreaId ? '#00ffff' : '#c7a15b', borderRadius: '50%', border: '2px solid #000', transform: 'translate(-50%, -50%)', zIndex: 20, pointerEvents: 'none', boxShadow: '0 0 10px #fff' }}/>
          )}
          
          {/* ŞU ANKİ ÇİZİM KÖŞELERİ */}
          {currentPolygon.map((p, idx) => (
            <div key={`bp-${idx}`} style={{ position: 'absolute', top: `${p.y}%`, left: `${p.x}%`, width: '6px', height: '6px', backgroundColor: '#ff0000', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 20, pointerEvents: 'none' }}/>
          ))}
        </div>
        </div>
      </div>

      {/* SAĞ: NOT DEFTERİ (SIDEBAR) */}
      <div style={styles.sidebar}>
        
        {/* SAYFA SEÇİMİ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => navigate(`/mapper/${Math.max(1, activePageId - 1)}`)} style={styles.pageBtn}>&lt;</button>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>Sayfa {activePageId} / 110</span>
          <button onClick={() => navigate(`/mapper/${Math.min(110, activePageId + 1)}`)} style={styles.pageBtn}>&gt;</button>
        </div>

        <h2 style={{ fontSize: '18px', margin: '0 0 15px 0', color: '#00ccff', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Haritalama (Sayfa {activePageId})
        </h2>

        {/* ANA ALAN SEÇİMİ VEYA EKLEME */}
        <div style={{ marginBottom: '20px', fontSize: '14px' }}>
          <div style={{ color: '#aaa', marginBottom: '8px' }}>Hedef Seçimi:</div>
          <select 
            value={selectedMainAreaId || ""}
            onChange={(e) => {
              const val = e.target.value;
              const matchedArea = mainAreas.find(a => String(a.id) === val);
              document.activeElement?.blur(); // Mobil klavyeyi kapatmak icin
              setSelectedMainAreaId(matchedArea ? matchedArea.id : null);
              setCurrentMainPoint(null);
              setCurrentPolygon([]);
              setDotModeChildId(null);
              setActiveChildId(null);
            }}
            style={styles.dropdown}
          >
            <option value="">➕ YENİ ANA ALAN ÇİZ</option>
            {mainAreas.map(a => (
              <option key={a.id} value={a.id}>➔ {a.name} (İçine Yavru Çiz)</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button onClick={undoLastPoint} disabled={!currentMainPoint} style={{...styles.btn, backgroundColor: '#444'}}>Geri Al</button>
          <button onClick={finishPolygon} disabled={currentPolygon.length < 3} style={{...styles.btn, backgroundColor: '#00cc66'}}>Kapat ve Kaydet</button>
        </div>

        {/* PARAGRAF GİRİŞ KUTUSU - sadece ana alan seçiliyken göster */}
        {selectedMainAreaId && (
          <div style={{ backgroundColor: '#0d1a0d', border: '1px solid #c7a15b88', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
            <div style={{ color: '#c7a15b', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>
              📝 Ana Alana Ait Paragraf
            </div>
            <textarea
              key={`para-${selectedMainAreaId}`}
              defaultValue={mainAreas.find(a => a.id === selectedMainAreaId)?.paragraph || ''}
              placeholder="Bu ana alana ait paragrafı buraya yazın..."
              onBlur={async (e) => {
                const text = e.target.value;
                try {
                  await api.updateMainArea(selectedMainAreaId, { paragraph: text });
                  setMainAreas(prev => prev.map(a => a.id === selectedMainAreaId ? { ...a, paragraph: text } : a));
                } catch(err) { console.error('Paragraf kaydedilemedi', err); }
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                minHeight: '110px', padding: '10px',
                borderRadius: '6px', border: '1px solid #555',
                backgroundColor: '#111', color: '#e6e6e6',
                fontSize: '13px', lineHeight: '1.8', resize: 'vertical',
                fontFamily: 'inherit', outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = '#c7a15b'}
              onBlurCapture={e => e.target.style.borderColor = '#555'}
            />
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              💾 Kutunun dışına tıklayınca kaydedilir · Firebase'e anında yansır
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
            {selectedMainAreaId ? `Yavrular (${currentChildren.length})` : `Ana Alanlar (${mainAreas.length})`}
          </h3>
        </div>

        <div style={styles.codeOutput}>
          {selectedMainAreaId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentChildren.length === 0
                ? <span style={{color: '#888'}}>Bu alana yavru eklenmedi.</span>
                :
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentChildren.map((c, idx) => (
                <div key={c.id} 
                  onClick={() => setActiveChildId(c.id)}
                  style={{
                    padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px', 
                    borderLeft: activeChildId === c.id ? '3px solid #ffcc00' : '3px solid #00ffff',
                    boxShadow: activeChildId === c.id ? '0 0 10px rgba(255,204,0,0.3)' : 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{color: activeChildId === c.id ? '#ffcc00' : '#00ffff', fontWeight: 'bold'}}>Yavru #{idx + 1}</span>
                    <button onClick={() => deleteChildArea(c.id)} style={{color:'#ff4444', background:'none', border:'none', cursor:'pointer', fontSize: '12px'}}>Sil</button>
                  </div>
                  <textarea
                    placeholder="Latince metin (Birden fazla satır yazabilirsiniz)" 
                    value={c.latinText || ""}
                    onChange={(e) => updateChildLatin(c.id, e.target.value)}
                    onBlur={(e) => saveChildLatin(c.id, e.target.value)}
                    style={{ 
                      padding: '8px', borderRadius: '4px', border: '1px solid #444', 
                      backgroundColor: '#000', color: '#fff', width: '100%', 
                      boxSizing: 'border-box', minHeight: '60px', resize: 'vertical',
                      fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.5'
                    }}
                  />
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button 
                      onClick={() => setDotModeChildId(dotModeChildId === c.id ? null : c.id)} 
                      style={{
                        backgroundColor: dotModeChildId === c.id ? '#ff3333' : 'transparent', 
                        border: '1px solid #ff3333', color: dotModeChildId === c.id ? '#000' : '#ff3333', 
                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginTop: '5px', fontWeight: 'bold'
                      }}>
                      {dotModeChildId === c.id ? "🔴 Moddan Çık" : "🔴 Nokta Koy"}
                    </button>
                    {dotModeChildId === c.id && (
                       <span style={{fontSize: '11px', color: '#ff3333', marginTop: '10px'}}>Resmin üstüne tıklayarak nokta bırakın. Silmek için noktaya tıklayın.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
              }
            </div>
          ) : (
            mainAreas.length === 0 ? <span style={{color: '#888'}}>Henüz ana alan yok. Resimden çizin.</span> :
            mainAreas.map(m => (
              <div key={m.id} style={{ borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#c7a15b', fontWeight: 'bold', fontSize: '13px' }}>{m.name}</span>
                  <button onClick={() => deleteMainArea(m.id)} style={{color:'red', background:'none', border:'none', cursor:'pointer', fontSize: '12px'}}>Sil</button>
                </div>
                <textarea
                  placeholder="Bu ana alana ait paragraf metnini buraya yazın..."
                  defaultValue={m.paragraph || ''}
                  onBlur={async (e) => {
                    const text = e.target.value;
                    try {
                      await api.updateMainArea(m.id, { paragraph: text });
                      setMainAreas(prev => prev.map(a => a.id === m.id ? { ...a, paragraph: text } : a));
                    } catch(err) { console.error('Paragraf kaydedilemedi', err); }
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    minHeight: '90px', padding: '8px',
                    borderRadius: '6px', border: '1px solid #555',
                    backgroundColor: '#111', color: '#e6e6e6',
                    fontSize: '13px', lineHeight: '1.6', resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  💾 Alandan çıkınca otomatik kaydedilir
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
          * Çizimler otomatik olarak veritabanına kaydedilir.
        </div>
      </div>
    </div>
  );
}

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
    zIndex: 10,
    pointerEvents: 'none'
  },
  sidebar: {
    width: '300px',
    minWidth: '300px',
    backgroundColor: '#1e1e1e',
    borderLeft: '1px solid #333',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  },
  dropdown: {
    width: '100%', 
    padding: '10px', 
    backgroundColor: '#2a2a2a', 
    color: '#fff', 
    border: '1px solid #444', 
    borderRadius: '6px', 
    outline: 'none',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  floatingTooltip: {
    position: 'fixed',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: 9999,
    fontSize: '12px',
    fontWeight: 'bold',
    border: '1px solid #fff'
  },
  btn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
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
  codeOutput: {
    flex: 1,
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '10px',
    overflowY: 'auto',
    fontSize: '12px',
    color: '#e6e6e6'
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
