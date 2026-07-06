import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function MapperMode() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  // pageId can be a number ("1") or a draft string ("taslak-1")
  const activePageId = pageId || '1';
  const activePageIdNum = Number(activePageId); // NaN for taslak pages

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allPages, setAllPages] = useState([]);
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Sayfa değiştiğinde seçimleri ve zoom seviyesini sıfırla
    setSelectedMainAreaId(null);
    setCurrentMainPoint(null);
    setCurrentPolygon([]);
    setDotModeChildId(null);
    setActiveChildId(null);
    setZoomLevel(1);

    loadData();
  }, [activePageId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Tüm sayfaları yükle (navigasyon için)
      const pages = await api.getPages();
      // Numaralı sayfalar önce, taşlak sayfalar sonda
      const sorted = [
        ...pages.filter(p => !p.id.toString().startsWith('taslak')).sort((a, b) => parseInt(a.id) - parseInt(b.id)),
        ...pages.filter(p => p.id.toString().startsWith('taslak')).sort((a, b) => {
          const na = parseInt(a.id.replace('taslak-', '')) || 0;
          const nb = parseInt(b.id.replace('taslak-', '')) || 0;
          return na - nb;
        })
      ];
      setAllPages(sorted);

      const p = await api.getPage(activePageId);
      setPage(p);
      if (p) {
        const mAreas = await api.getMainAreas(activePageId);
        setMainAreas(mAreas);
        const cAreas = await api.getAllChildAreasForPage(activePageId);
        setChildAreas(cAreas);
      }
    } catch (err) {
      console.error("Veri yüklenemedi", err);
    }
    setLoading(false);
  };

  const handleAddNewPage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setLoading(true);
      
      let targetId = activePageId;
      if (page) { // Eğer zaten var olan bir sayfadaysak "Yeni Sayfa" ekleniyordur
        const pages = await api.getPages();
        const maxId = pages.length > 0 ? Math.max(...pages.map(p => parseInt(p.id) || 0)) : 0;
        targetId = maxId + 1;
      }
      
      // Upload image to Cloudinary
      const imageUrl = await api.uploadImage(file);
      
      await api.createPage({
        id: targetId.toString(),
        imageUrl: imageUrl,
        readingSequence: []
      });
      
      if (activePageId === targetId) {
        await loadData(); // Reload current page data
      } else {
        navigate(`/mapper/${targetId}`);
      }
    } catch (err) {
      alert("Sayfa oluşturulurken hata oluştu! " + err.message);
      console.error(err);
      setLoading(false);
    } finally {
      setUploading(false);
    }
    
    // Reset file input
    e.target.value = null;
  };

  const handleDeletePage = async () => {
    if (!window.confirm(`Sayfa ${activePageId} ve bu sayfadaki TÜM alan ve kelimeler silinecek. Emin misiniz?`)) return;
    try {
      setLoading(true);
      await api.deletePage(activePageId);
      // Silinen sayfadan sonraki ilk sayfaya git
      const remaining = allPages.filter(p => p.id.toString() !== activePageId.toString());
      navigate(`/mapper/${remaining.length > 0 ? remaining[0].id : '1'}`);
    } catch (err) {
      alert('Sayfa silinemedi: ' + err.message);
      setLoading(false);
    }
  };

  const handleRenamePage = async () => {
    const input = window.prompt(`Bu sayfanın yeni numarasını girin (şu an: ${activePageId}):`);
    if (!input || input.trim() === '') return;
    const newId = input.trim();
    if (newId === activePageId.toString()) return;
    try {
      setLoading(true);
      const result = await api.renamePage(activePageId, newId);
      navigate(`/mapper/${result.newId}`);
    } catch (err) {
      alert('Sayfa yeniden numaralandırılamadı: ' + err.message);
      setLoading(false);
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

  const updateChildDescription = (childId, newText) => {
    setChildAreas(childAreas.map(c => c.id === childId ? { ...c, description: newText } : c));
  };

  const saveChildDescription = async (childId, newText) => {
    try {
      await api.updateChildArea(childId, { description: newText });
    } catch(e) { console.error("Hata", e); }
  };

  const currentChildren = childAreas.filter(c => c.mainAreaId === selectedMainAreaId);

  if (uploading) return <div style={{color:'#00ccff', padding: '20px', fontSize: '18px', fontWeight: 'bold'}}>📸 Resim yükleniyor, lütfen bekleyin... (Bu işlem dosya boyutuna göre birkaç saniye sürebilir)</div>;
  if (loading) return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111', color: '#fff'}}>
      <div style={{width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #00ccff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px'}} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <div style={{fontSize: '18px', fontWeight: 'bold'}}>Sayfa Yükleniyor...</div>
      <div style={{color: '#888', marginTop: '10px', fontSize: '14px'}}>Veriler getiriliyor, lütfen bekleyin.</div>
    </div>
  );
  if (!page) {
    return (
      <div style={{color:'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start'}}>
        <h2>Sayfa Bulunamadı ({activePageId})</h2>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={onFileSelected} 
        />
        <button onClick={handleAddNewPage} style={{...styles.btn, backgroundColor: '#00cc66', width: 'auto', padding: '10px 20px'}}>➕ Bu Sayfayı Oluştur Veya Yeni Sayfa Ekle</button>
        <button onClick={() => navigate('/mapper/1')} style={{...styles.btn, backgroundColor: '#444', width: 'auto', padding: '10px 20px'}}>← İlk Sayfaya Dön</button>
      </div>
    );
  }

  return (
    <div style={styles.mainLayout}>
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={onFileSelected} 
      />
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
        
        {/* SAYFA SEÇİMİ - dinamik, sadece gerçek sayfalar */}
        {(() => {
          const isDraft = activePageId.toString().startsWith('taslak');
          const groupPages = allPages.filter(p => p.id.toString().startsWith('taslak') === isDraft);
          const currentIndex = groupPages.findIndex(p => p.id.toString() === activePageId.toString());
          const prevPage = currentIndex > 0 ? groupPages[currentIndex - 1] : null;
          const nextPage = currentIndex < groupPages.length - 1 ? groupPages[currentIndex + 1] : null;
          return (
            <div style={{ marginBottom: '10px' }}>
              {/* Ok navigasyonu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <button
                  onClick={() => prevPage && navigate(`/mapper/${prevPage.id}`)}
                  disabled={!prevPage}
                  style={{ ...styles.pageBtn, opacity: prevPage ? 1 : 0.3, cursor: prevPage ? 'pointer' : 'default' }}
                >&lt;</button>
                <span style={{ color: activePageId.toString().startsWith('taslak') ? '#ffaa44' : '#fff', fontWeight: 'bold', fontSize: '13px' }}>
                  {activePageId.toString().startsWith('taslak') ? `📄 ${activePageId}` : `Sayfa ${activePageId}`}
                  <span style={{ color: '#666', fontSize: '11px', marginLeft: '6px' }}>({currentIndex + 1}/{groupPages.length})</span>
                </span>
                {nextPage ? (
                  <button
                    onClick={() => navigate(`/mapper/${nextPage.id}`)}
                    style={{ ...styles.pageBtn, cursor: 'pointer' }}
                  >&gt;</button>
                ) : (
                  <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '12px', padding: '5px 10px', backgroundColor: '#331111', borderRadius: '4px' }}>SON</span>
                )}
              </div>
              {/* Dropdown - tüm sayfalar */}
              <select
                value={activePageId.toString()}
                onChange={e => navigate(`/mapper/${e.target.value}`)}
                style={{ ...styles.dropdown, fontSize: '12px', padding: '6px 8px' }}
              >
                <optgroup label="📖 Sayfalar">
                  {allPages.filter(p => !p.id.toString().startsWith('taslak')).map(p => (
                    <option key={p.id} value={p.id.toString()}>Sayfa {p.id}</option>
                  ))}
                </optgroup>
                {allPages.some(p => p.id.toString().startsWith('taslak')) && (
                  <optgroup label="📄 Taslaklar">
                    {allPages.filter(p => p.id.toString().startsWith('taslak')).map(p => (
                      <option key={p.id} value={p.id.toString()}>{p.id}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          );
        })()}
        
        <button onClick={handleAddNewPage} style={{...styles.btn, backgroundColor: '#334433', border: '1px solid #00cc66', color: '#00cc66', marginBottom: '8px'}}>➕ Yeni Sayfa Ekle</button>
        
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          <button
            onClick={handleRenamePage}
            style={{ flex: 1, padding: '8px', backgroundColor: '#1a2a3a', border: '1px solid #4488cc', color: '#4488cc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
          >🔢 Numarayı Değiştir</button>
          <button
            onClick={handleDeletePage}
            style={{ flex: 1, padding: '8px', backgroundColor: '#2a1a1a', border: '1px solid #cc4444', color: '#cc4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
          >🗑️ Sayfayı Sil</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <div style={{ fontSize: '11px', color: '#666' }}>
                💾 Kutunun dışına tıklayınca kaydedilir · Firebase'e anında yansır
              </div>
              <button 
                onClick={() => deleteMainArea(selectedMainAreaId)}
                style={{ backgroundColor: '#2a1a1a', border: '1px solid #cc4444', color: '#cc4444', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '11px' }}
              >🗑️ Ana Alanı Sil</button>
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
                    padding: '16px', backgroundColor: activeChildId === c.id ? '#1e1e1e' : '#151515', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', 
                    border: activeChildId === c.id ? '1px solid #c7a15b' : '1px solid #333',
                    borderLeft: activeChildId === c.id ? '4px solid #c7a15b' : '4px solid #333',
                    boxShadow: activeChildId === c.id ? '0 4px 15px rgba(0,0,0,0.5)' : 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{color: activeChildId === c.id ? '#c7a15b' : '#888', fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px'}}>{idx + 1}. YAVRU ALAN</span>
                    <button onClick={() => deleteChildArea(c.id)} style={{color:'#ff4444', background:'rgba(255, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', border:'none', cursor:'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'background 0.2s'}}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.1)'}
                    >SİL</button>
                  </div>
                  
                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label style={{fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Latince Okunuşu</label>
                    <textarea
                      placeholder="Latince metin (Birden fazla satır yazabilirsiniz)" 
                      value={c.latinText || ""}
                      onChange={(e) => updateChildLatin(c.id, e.target.value)}
                      style={{ 
                        padding: '10px', borderRadius: '6px', border: '1px solid #444', 
                        backgroundColor: '#0a0a0a', color: '#fff', width: '100%', 
                        boxSizing: 'border-box', minHeight: '70px', resize: 'vertical',
                        fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#c7a15b'}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#444'; saveChildLatin(c.id, e.target.value); }}
                    />
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label style={{fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Neyden Bahsediyor?</label>
                    <input
                      placeholder="İçerik özeti veya notlar" 
                      value={c.description || ""}
                      onChange={(e) => updateChildDescription(c.id, e.target.value)}
                      style={{ 
                        padding: '10px', borderRadius: '6px', border: '1px solid #444', 
                        backgroundColor: '#0a0a0a', color: '#c7c7c7', width: '100%', 
                        boxSizing: 'border-box',
                        fontFamily: 'inherit', fontSize: '13px',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#c7a15b'}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#444'; saveChildDescription(c.id, e.target.value); }}
                    />
                  </div>
                  
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', borderTop: '1px dashed #333', paddingTop: '12px'}}>
                    <button 
                      onClick={() => setDotModeChildId(dotModeChildId === c.id ? null : c.id)} 
                      style={{
                        backgroundColor: dotModeChildId === c.id ? 'rgba(255, 51, 51, 0.15)' : 'transparent', 
                        border: '1px solid #ff3333', color: '#ff3333', 
                        padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        if (dotModeChildId !== c.id) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 51, 51, 0.1)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (dotModeChildId !== c.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      >
                      {dotModeChildId === c.id ? "🔴 Modu Kapat" : "🔴 Nokta Koy"}
                    </button>
                    {dotModeChildId === c.id && (
                       <span style={{fontSize: '11px', color: '#aaa', flex: 1, lineHeight: '1.3'}}>Resme tıklayıp nokta bırakın. Silmek için noktaya tıklayın.</span>
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
