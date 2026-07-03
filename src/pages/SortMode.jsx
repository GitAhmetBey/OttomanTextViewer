import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    if (page && mainAreas && childAreas) {
      if (page.readingSequence && page.readingSequence.length > 0) {
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
        
        currentSeq = currentSeq.filter(s => {
          if (s.type === 'main') return mainAreas.find(m => m.id === s.id);
          if (s.type === 'child') return childAreas.find(c => c.id === s.id);
          return false;
        });
        
        setSequence(currentSeq);
      } else {
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

  const orderedMainAreas = useMemo(() => {
    const mains = sequence.filter(s => s.type === 'main').map(s => mainAreas.find(m => m.id === s.id)).filter(Boolean);
    mainAreas.forEach(m => {
      if (!mains.find(mx => mx.id === m.id)) mains.push(m);
    });
    return mains;
  }, [sequence, mainAreas]);

  const getOrderedChildren = useCallback((mainId) => {
    const childrenOfMain = childAreas.filter(c => c.mainAreaId === mainId);
    const sorted = [];
    sequence.forEach(s => {
      if (s.type === 'child') {
        const c = childrenOfMain.find(cx => cx.id === s.id);
        if (c) sorted.push(c);
      }
    });
    childrenOfMain.forEach(c => {
      if (!sorted.find(sx => sx.id === c.id)) sorted.push(c);
    });
    return sorted;
  }, [sequence, childAreas]);

  const handleDragEnd = (result) => {
    const { destination, source, type } = result;
    if (!destination) return;

    if (type === 'MAIN') {
      const newOrderedMains = Array.from(orderedMainAreas);
      const [reorderedItem] = newOrderedMains.splice(source.index, 1);
      newOrderedMains.splice(destination.index, 0, reorderedItem);

      const newSequence = [];
      newOrderedMains.forEach(main => {
        newSequence.push({ id: main.id, type: 'main' });
        const children = getOrderedChildren(main.id);
        children.forEach(child => {
          newSequence.push({ id: child.id, type: 'child' });
        });
      });
      saveSequence(newSequence);
      return;
    }

    if (type === 'CHILD') {
      const sourceMainId = source.droppableId;
      const destMainId = destination.droppableId;
      
      if (sourceMainId !== destMainId) return; // Sadece kendi ana alanı içinde sıralanabilir

      const children = getOrderedChildren(sourceMainId);
      const [reorderedChild] = children.splice(source.index, 1);
      children.splice(destination.index, 0, reorderedChild);

      const newSequence = [];
      orderedMainAreas.forEach(main => {
        newSequence.push({ id: main.id, type: 'main' });
        const currentChildren = main.id === sourceMainId ? children : getOrderedChildren(main.id);
        currentChildren.forEach(child => {
          newSequence.push({ id: child.id, type: 'child' });
        });
      });
      saveSequence(newSequence);
      return;
    }
  };

  if (loading) return <div style={{color:'white', padding: '20px'}}>Yükleniyor...</div>;

  return (
    <div style={styles.container}>
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
          ℹ️ <strong>Sıralama Modu:</strong> Ana alanları sürükleyerek blok halinde taşıyabilir, yavru kelimeleri ise <u>sadece kendi ana alanı içinde</u> sıralayabilirsiniz.
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="main-areas" type="MAIN">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                style={styles.listContainer}
              >
                {orderedMainAreas.map((mainArea, mainIndex) => {
                  const children = getOrderedChildren(mainArea.id);
                  
                  return (
                    <Draggable key={`main-${mainArea.id}`} draggableId={`main-${mainArea.id}`} index={mainIndex}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...styles.mainCard,
                            ...provided.draggableProps.style,
                            borderColor: snapshot.isDragging ? '#c7a15b' : '#333',
                            boxShadow: snapshot.isDragging ? '0 15px 30px rgba(0,0,0,0.8)' : '0 4px 6px rgba(0,0,0,0.3)',
                          }}
                        >
                          <div {...provided.dragHandleProps} style={styles.mainHeader}>
                            <div style={styles.dragIcon}>☰</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={styles.indexBadgeMain}>{mainIndex + 1}</span>
                              <span style={{ color: '#c7a15b', fontWeight: 'bold', fontSize: '18px' }}>
                                {mainArea.name || "İsimsiz Ana Alan"}
                              </span>
                            </div>
                          </div>

                          <Droppable droppableId={mainArea.id} type="CHILD">
                            {(provided, childDropSnapshot) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                style={{
                                  ...styles.childListContainer,
                                  backgroundColor: childDropSnapshot.isDraggingOver ? 'rgba(0, 255, 255, 0.05)' : 'transparent'
                                }}
                              >
                                {children.map((child, childIndex) => (
                                  <Draggable key={`child-${child.id}`} draggableId={`child-${child.id}`} index={childIndex}>
                                    {(provided, childSnapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        style={{
                                          ...styles.childItem,
                                          ...provided.draggableProps.style,
                                          backgroundColor: childSnapshot.isDragging ? '#2a2a2a' : '#1a1a1a',
                                          boxShadow: childSnapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.6)' : 'none',
                                          borderColor: childSnapshot.isDragging ? '#00ffff' : 'transparent'
                                        }}
                                      >
                                        <div style={{...styles.dragIcon, fontSize: '16px', color: '#555', padding: '0 5px'}}>☰</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                          <span style={styles.indexBadgeChild}>{mainIndex + 1}.{childIndex + 1}</span>
                                          <span style={{ color: '#00ffff', fontSize: '15px' }}>
                                            {child.latinText || "Latince girilmemiş yavru"}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                {children.length === 0 && (
                                  <div style={{ color: '#555', padding: '10px', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
                                    Bu alanda henüz yavru kelime yok.
                                  </div>
                                )}
                              </div>
                            )}
                          </Droppable>
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
  container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#111', color: '#fff' },
  header: { padding: '15px 30px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tabs: { display: 'flex', gap: '10px' },
  tabBtn: { padding: '10px 20px', backgroundColor: '#2a2a2a', color: '#ccc', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' },
  activeTab: { backgroundColor: '#c7a15b', color: '#000', borderColor: '#c7a15b' },
  pageBtn: { padding: '8px 15px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  content: { flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  infoBox: { width: '100%', maxWidth: '800px', backgroundColor: 'rgba(199, 161, 91, 0.1)', border: '1px solid #c7a15b', color: '#c7a15b', padding: '15px', borderRadius: '8px', marginBottom: '20px', lineHeight: '1.5' },
  listContainer: { width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' },
  mainCard: { backgroundColor: '#1e1e1e', border: '2px solid #333', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  mainHeader: { display: 'flex', alignItems: 'center', padding: '15px', backgroundColor: '#252525', borderBottom: '1px solid #333' },
  childListContainer: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '50px', transition: 'background-color 0.2s' },
  childItem: { display: 'flex', alignItems: 'center', padding: '10px', borderRadius: '6px', gap: '10px', borderLeft: '3px solid #00ffff', border: '1px solid transparent' },
  dragIcon: { color: '#666', fontSize: '24px', cursor: 'grab', padding: '0 10px' },
  indexBadgeMain: { backgroundColor: '#c7a15b', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold' },
  indexBadgeChild: { backgroundColor: 'rgba(0, 255, 255, 0.2)', color: '#00ffff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }
};
