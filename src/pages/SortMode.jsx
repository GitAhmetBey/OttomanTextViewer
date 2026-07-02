import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';

export default function SortMode() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const activePageId = Number(pageId || 1);

  const [page, setPage] = useState(null);
  const [mainAreas, setMainAreas] = useState([]);
  const [childAreas, setChildAreas] = useState([]);
  const [sequence, setSequence] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const p = await api.getPage(activePageId);
        setPage(p);
      } catch (err) {
        console.error("Sayfa yüklenirken hata:", err);
      }
    };
    loadData();

    const unsubMain = api.subscribeToMainAreas(activePageId, setMainAreas);
    const unsubChildren = api.subscribeToChildAreasForPage(activePageId, setChildAreas);

    return () => {
      unsubMain();
      unsubChildren();
    };
  }, [activePageId]);

  useEffect(() => {
    // Only process sequence when we have loaded everything
    if (page && mainAreas && childAreas) {
      if (page.readingSequence && page.readingSequence.length > 0) {
        // We have a saved sequence, let's make sure it contains all current areas
        // Add any missing areas to the end
        let currentSeq = [...page.readingSequence];
        
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
        
        // Remove deleted areas
        currentSeq = currentSeq.filter(s => {
          if (s.type === 'main') return mainAreas.find(m => m.id === s.id);
          if (s.type === 'child') return childAreas.find(c => c.id === s.id);
          return false;
        });
        
        setSequence(currentSeq);
      } else {
        // Generate default sequence: Main1 -> Child1 -> Child2 -> Main2...
        const defaultSeq = [];
        mainAreas.forEach(m => {
          defaultSeq.push({ id: m.id, type: 'main' });
          childAreas.filter(c => c.mainAreaId === m.id).forEach(c => {
            defaultSeq.push({ id: c.id, type: 'child' });
          });
        });
        setSequence(defaultSeq);
      }
      setLoading(false);
    }
  }, [page, mainAreas, childAreas]);

  const saveSequence = async (newSeq) => {
    setSequence(newSeq);
    try {
      await api.updatePageSequence(activePageId, newSeq);
    } catch (err) {
      console.error("Sıralama kaydedilemedi", err);
      alert("Sıralama kaydedilirken hata oluştu!");
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(sequence);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    saveSequence(items);
  };

  if (loading) return <div style={{color:'white', padding: '20px'}}>Yükleniyor...</div>;

  return (
    <div style={styles.container}>
      {/* HEADER TABS */}
      <div style={styles.header}>
        <div style={styles.tabs}>
          <button onClick={() => navigate(`/overview/${activePageId}`)} style={styles.tabBtn}>📖 Okuma Modu</button>
          <button onClick={() => navigate(`/mapper/${activePageId}`)} style={styles.tabBtn}>✏️ Haritalama Modu</button>
          <button style={{...styles.tabBtn, ...styles.activeTab}}>🔄 Sıralama Modu</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(`/sort/${Math.max(1, activePageId - 1)}`)} style={styles.pageBtn}>&lt;</button>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>Sayfa {activePageId} / 110</span>
          <button onClick={() => navigate(`/sort/${Math.min(110, activePageId + 1)}`)} style={styles.pageBtn}>&gt;</button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.infoBox}>
          ℹ️ <strong>Sıralama Modu:</strong> Aşağıdaki öğeleri tutup sürükleyerek okuma sırasını (slayt geçiş sırasını) değiştirebilirsiniz. Yaptığınız değişiklikler anında kaydedilir.
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sequence-list">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                style={styles.listContainer}
              >
                {sequence.map((item, index) => {
                  let text = "Bilinmeyen Öğe";
                  let subtext = "";
                  let isMain = item.type === 'main';
                  
                  if (isMain) {
                    const ma = mainAreas.find(m => m.id === item.id);
                    text = ma ? (ma.name || "İsimsiz Ana Alan") : "Silinmiş Ana Alan";
                    subtext = "Ana Paragraf Alanı";
                  } else {
                    const ca = childAreas.find(c => c.id === item.id);
                    text = ca ? (ca.latinText || "Latince girilmemiş yavru") : "Silinmiş Yavru";
                    const parent = mainAreas.find(m => m.id === ca?.mainAreaId);
                    subtext = parent ? `Bağlı Ana Alan: ${parent.name}` : "Bağımsız Yavru";
                  }

                  return (
                    <Draggable key={`${item.type}-${item.id}`} draggableId={`${item.type}-${item.id}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...styles.listItem,
                            ...provided.draggableProps.style,
                            backgroundColor: snapshot.isDragging ? '#2a2a2a' : '#1a1a1a',
                            borderLeft: isMain ? '4px solid #c7a15b' : '4px solid #00ffff',
                            boxShadow: snapshot.isDragging ? '0 10px 20px rgba(0,0,0,0.5)' : 'none'
                          }}
                        >
                          <div style={styles.dragIcon}>☰</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={styles.indexBadge}>{index + 1}</span>
                              <span style={{ color: isMain ? '#c7a15b' : '#00ffff', fontWeight: 'bold', fontSize: '16px' }}>{text}</span>
                            </div>
                            <span style={{ color: '#888', fontSize: '12px' }}>{subtext}</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#111',
    color: '#fff'
  },
  header: {
    padding: '15px 30px',
    backgroundColor: '#1e1e1e',
    borderBottom: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tabs: {
    display: 'flex',
    gap: '10px'
  },
  tabBtn: {
    padding: '10px 20px',
    backgroundColor: '#2a2a2a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  activeTab: {
    backgroundColor: '#c7a15b',
    color: '#000',
    borderColor: '#c7a15b'
  },
  pageBtn: {
    padding: '8px 15px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  infoBox: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'rgba(199, 161, 91, 0.1)',
    border: '1px solid #c7a15b',
    color: '#c7a15b',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    lineHeight: '1.5'
  },
  listContainer: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    borderRadius: '8px',
    gap: '15px'
  },
  dragIcon: {
    color: '#666',
    fontSize: '24px',
    cursor: 'grab',
    padding: '0 10px'
  },
  indexBadge: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  }
};
