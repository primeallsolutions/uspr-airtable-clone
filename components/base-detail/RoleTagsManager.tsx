import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RoleTag = { id: string; name: string; color: string | null };

interface RoleTagsManagerProps {
  scopeType: 'workspace' | 'base';
  scopeId: string;
}

export const RoleTagsManager = ({ scopeType, scopeId }: RoleTagsManagerProps) => {
  const [tags, setTags] = useState<RoleTag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('role_tags')
      .select('id, name, color')
      .eq('scope_type', scopeType)
      .eq('scope_id', scopeId)
      .order('name');
    if (error) setError(error.message);
    setTags((data ?? []) as RoleTag[]);
    setLoading(false);
  }, [scopeId, scopeType]);

  useEffect(() => { void loadTags(); }, [loadTags]);

  const addTag = async () => {
    if (!name.trim()) return;
    setError(null);
    const { data, error } = await supabase
      .from('role_tags')
      .insert({ scope_type: scopeType, scope_id: scopeId, name: name.trim(), color: color || null })
      .select('id, name, color')
      .single();
    if (error) { setError(error.message); return; }
    setTags(prev => [...prev, data as RoleTag]);
    setName("");
    setColor("");
  };

  const removeTag = async (tagId: string) => {
    const { error } = await supabase
      .from('role_tags')
      .delete()
      .eq('id', tagId);
    if (error) { setError(error.message); return; }
    setTags(prev => prev.filter(t => t.id !== tagId));
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Role Tags</h4>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="flex items-center gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tag name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#RRGGBB (optional)"
          className="w-44 px-3 py-2 border border-gray-300 rounded-md"
        />
        <button onClick={addTag} className="px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Add</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading tags...</div>
      ) : tags.length === 0 ? (
        <div className="text-sm text-gray-500">No tags yet.</div>
      ) : (
        <ul className="space-y-2">
          {tags.map(tag => (
            <li key={tag.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-3">
                {tag.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />}
                <span className="text-sm text-gray-800">{tag.name}</span>
                {tag.color && <span className="text-xs text-gray-500">{tag.color}</span>}
              </div>
              <button onClick={() => removeTag(tag.id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};





