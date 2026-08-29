import { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, ChevronDown } from 'lucide-react';
import { Allowance, ALLOWANCE_COLORS, ALLOWANCE_COLOR_CLASSES } from '../utils/gamification';
import { dataService } from '../services/dataService';

interface AllowanceManagerProps {
  uid: string;
  allowances: Allowance[];
  onChanged: () => void;
}

const EMOJI_OPTIONS = ['🚗', '🍔', '🎮', '🏥', '🛍️', '✈️', '📚', '☕', '💡', '🎵', '🏋️', '🐶', '🎬', '👕', '⚽', '🎯'];

const PRESET_KEYWORDS: Record<string, string[]> = {
  '🚗': ['transport', 'gas', 'travel', 'fuel', 'transit', 'uber', 'taxi'],
  '🍔': ['food', 'rations', 'groceries', 'dining', 'restaurant', 'coffee', 'lunch'],
  '🎮': ['entertainment', 'gaming', 'game', 'steam', 'netflix'],
  '🏥': ['health', 'medical', 'pharmacy', 'doctor'],
  '🛍️': ['shopping', 'gear', 'clothes', 'retail'],
  '✈️': ['flight', 'hotel', 'holiday', 'vacation', 'travel'],
  '📚': ['education', 'books', 'course', 'subscription'],
  '☕': ['coffee', 'cafe', 'drinks'],
  '💡': ['utilities', 'electricity', 'water', 'internet'],
  '🎵': ['music', 'spotify', 'concert'],
  '🏋️': ['gym', 'fitness', 'sport'],
  '🐶': ['pet', 'vet', 'animal'],
  '🎬': ['cinema', 'movies', 'streaming'],
  '👕': ['clothing', 'fashion', 'apparel'],
  '⚽': ['sport', 'team', 'activity'],
  '🎯': ['misc', 'other', 'hobby'],
};

interface AllowanceFormState {
  name: string;
  icon: string;
  weeklyBudget: string;
  color: Allowance['color'];
  keywords: string; // comma separated
}

const emptyForm = (): AllowanceFormState => ({
  name: '',
  icon: '🎯',
  weeklyBudget: '',
  color: 'violet',
  keywords: '',
});

export const AllowanceManager = ({ uid, allowances, onChanged }: AllowanceManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AllowanceFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setError('');
    setIsOpen(true);
  };

  const openEdit = (a: Allowance) => {
    setEditId(a.id);
    setForm({
      name: a.name,
      icon: a.icon,
      weeklyBudget: String(a.weeklyBudget),
      color: a.color,
      keywords: a.matchKeywords.join(', '),
    });
    setError('');
    setIsOpen(true);
  };

  const handleEmojiChange = (emoji: string) => {
    const presetKw = PRESET_KEYWORDS[emoji];
    setForm((f) => ({
      ...f,
      icon: emoji,
      keywords: f.keywords || (presetKw ? presetKw.join(', ') : f.keywords),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const budget = parseFloat(form.weeklyBudget);
    if (isNaN(budget) || budget < 0) { setError('Enter a valid weekly budget.'); return; }
    const keywords = form.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) { setError('Add at least one keyword to match transactions.'); return; }

    setSaving(true);
    setError('');
    try {
      if (editId) {
        await dataService.updateAllowance(uid, editId, {
          name: form.name.trim(),
          icon: form.icon,
          weeklyBudget: budget,
          color: form.color,
          matchKeywords: keywords,
        });
      } else {
        await dataService.addAllowance(uid, {
          name: form.name.trim(),
          icon: form.icon,
          weeklyBudget: budget,
          color: form.color,
          matchKeywords: keywords,
        });
      }
      onChanged();
      setIsOpen(false);
      setForm(emptyForm());
      setEditId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to save allowance.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await dataService.deleteAllowance(uid, id);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setForm(emptyForm());
    setEditId(null);
    setError('');
  };

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-violet-100 dark:border-violet-800/30">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎛️</span>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Allowance Manager</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{allowances.length} allowance{allowances.length !== 1 ? 's' : ''} configured</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-all duration-200 active:scale-95 shadow-md shadow-violet-500/30"
        >
          <Plus size={13} />
          Add New
        </button>
      </div>

      {/* Existing allowances list */}
      <div className="divide-y divide-violet-100 dark:divide-violet-800/20">
        {allowances.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-gray-400">No allowances yet. Add one!</div>
        )}
        {allowances.map((a) => {
          const cls = ALLOWANCE_COLOR_CLASSES[a.color];
          return (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors">
              <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl ${cls.bg}`}>{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{a.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold ${cls.badge}`}>{a.color}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">\${a.weeklyBudget}/wk · {a.matchKeywords.slice(0, 3).join(', ')}{a.matchKeywords.length > 3 ? '…' : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(a)}
                  className="p-2 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-600 dark:text-violet-400 transition-colors"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit form panel */}
      {isOpen && (
        <div className="border-t border-violet-200 dark:border-violet-800/40 bg-white dark:bg-gray-900/60 px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">{editId ? 'Edit Allowance' : 'New Allowance'}</h4>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiChange(emoji)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all duration-150 ${
                    form.icon === emoji
                      ? 'ring-2 ring-violet-500 bg-violet-100 dark:bg-violet-900/50 scale-110'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Name</label>
            <input
              type="text"
              placeholder="e.g. Coffee Budget"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Weekly budget */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Weekly Budget (\$)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 50"
              value={form.weeklyBudget}
              onChange={(e) => setForm((f) => ({ ...f, weeklyBudget: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Color Theme</label>
            <div className="flex flex-wrap gap-2">
              {ALLOWANCE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all duration-150 ${ALLOWANCE_COLOR_CLASSES[c].badge} ${
                    form.color === c ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : 'hover:scale-105'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Match Keywords <span className="font-normal text-gray-400">(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. food, grocery, coffee"
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Transactions whose category or description matches any keyword will count toward this allowance.</p>
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-md shadow-violet-500/30"
            >
              {saving ? (
                <span className="animate-pulse">Saving…</span>
              ) : (
                <>
                  <Check size={14} />
                  {editId ? 'Save Changes' : 'Create Allowance'}
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Collapsible toggle when form closed */}
      {!isOpen && allowances.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <ChevronDown size={13} />
          Add or edit allowances
        </button>
      )}
    </div>
  );
};

export default AllowanceManager;
