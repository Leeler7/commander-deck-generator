'use client';

import { useState, useEffect } from 'react';

interface TagData {
  id: number;
  name: string;
  category: string;
  description?: string;
  synergy_weight: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export default function TagManagerPage() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [newTag, setNewTag] = useState({
    name: '',
    category: '',
    description: '',
    synergy_weight: 1.0,
    is_active: true
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadTags();
  }, [selectedCategory, showActiveOnly]);

  const loadTags = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (showActiveOnly) params.set('active_only', 'true');

      const response = await fetch(`/api/admin/manage-tags?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    try {
      const response = await fetch('/api/admin/manage-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      setNewTag({ name: '', category: '', description: '', synergy_weight: 1.0, is_active: true });
      setShowAddForm(false);
      await loadTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (tag: TagData) => {
    try {
      const response = await fetch('/api/admin/manage-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      setEditingTag(null);
      await loadTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      const response = await fetch(`/api/admin/manage-tags?id=${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      await loadTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete tag');
    }
  };

  const categories = [...new Set(tags.map(tag => tag.category))].sort();

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Normalized Tag Manager</h1>
      
      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <div>
          <label>Category: </label>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label>
            <input 
              type="checkbox" 
              checked={showActiveOnly} 
              onChange={e => setShowActiveOnly(e.target.checked)} 
            /> Active Tags Only
          </label>
        </div>
        
        <button 
          onClick={() => setShowAddForm(true)}
          style={{ background: '#2196f3', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Add New Tag
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: '#f5f5f5', padding: '15px', marginBottom: '20px', borderRadius: '8px' }}>
          <h3>Add New Tag</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              placeholder="Tag Name"
              value={newTag.name}
              onChange={e => setNewTag({...newTag, name: e.target.value})}
            />
            <input
              placeholder="Category"
              value={newTag.category}
              onChange={e => setNewTag({...newTag, category: e.target.value})}
            />
            <input
              placeholder="Description (optional)"
              value={newTag.description}
              onChange={e => setNewTag({...newTag, description: e.target.value})}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Synergy Weight"
              value={newTag.synergy_weight}
              onChange={e => setNewTag({...newTag, synergy_weight: parseFloat(e.target.value) || 1.0})}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input 
                type="checkbox" 
                checked={newTag.is_active} 
                onChange={e => setNewTag({...newTag, is_active: e.target.checked})} 
              /> Active
            </label>
          </div>
          <button onClick={handleCreateTag} style={{ marginRight: '10px', background: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Create Tag
          </button>
          <button onClick={() => setShowAddForm(false)} style={{ background: '#f44336', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #eee', background: '#f9f9f9', fontWeight: 'bold' }}>
          {loading ? 'Loading...' : `${tags.length} Tags`}
        </div>
        
        {!loading && (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {tags.map(tag => (
              <div key={tag.id} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                {editingTag?.id === tag.id ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input
                        value={editingTag.name}
                        onChange={e => setEditingTag({...editingTag, name: e.target.value})}
                      />
                      <input
                        value={editingTag.category}
                        onChange={e => setEditingTag({...editingTag, category: e.target.value})}
                      />
                      <input
                        value={editingTag.description || ''}
                        onChange={e => setEditingTag({...editingTag, description: e.target.value})}
                        placeholder="Description"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={editingTag.synergy_weight}
                        onChange={e => setEditingTag({...editingTag, synergy_weight: parseFloat(e.target.value) || 1.0})}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>
                        <input 
                          type="checkbox" 
                          checked={editingTag.is_active} 
                          onChange={e => setEditingTag({...editingTag, is_active: e.target.checked})} 
                        /> Active
                      </label>
                    </div>
                    <button onClick={() => handleUpdateTag(editingTag)} style={{ marginRight: '10px', background: '#4caf50', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Save
                    </button>
                    <button onClick={() => setEditingTag(null)} style={{ background: '#f44336', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: tag.is_active ? '#333' : '#999' }}>
                          {tag.name}
                          {!tag.is_active && <span style={{ color: '#f44336', marginLeft: '8px' }}>(INACTIVE)</span>}
                        </h4>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                          <strong>Category:</strong> {tag.category} | 
                          <strong> Weight:</strong> {tag.synergy_weight} | 
                          <strong> Usage:</strong> {tag.usage_count} cards
                        </div>
                        {tag.description && (
                          <div style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                            {tag.description}
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                          Created: {new Date(tag.created_at).toLocaleDateString()} | 
                          Updated: {new Date(tag.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                        <button 
                          onClick={() => setEditingTag(tag)}
                          style={{ background: '#2196f3', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteTag(tag.id)}
                          disabled={tag.usage_count > 0}
                          style={{ 
                            background: tag.usage_count > 0 ? '#ccc' : '#f44336', 
                            color: 'white', 
                            padding: '4px 8px', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: tag.usage_count > 0 ? 'not-allowed' : 'pointer',
                            fontSize: '12px'
                          }}
                          title={tag.usage_count > 0 ? `Cannot delete: used by ${tag.usage_count} cards` : 'Delete tag'}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}