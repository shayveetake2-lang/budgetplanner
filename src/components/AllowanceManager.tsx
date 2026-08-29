import { useState } from 'react';
import { Plus, Trash2, Edit3, ChevronDown } from 'lucide-react';
import { Allowance, ALLOWANCE_COLOR_CLASSES } from '../utils/gamification';
import { dataService } from '../services/dataService';

interface AllowanceManagerProps {
  uid: string;
  allowances: Allowance[];
  onChanged: () => void;
  onAddClick: () => void;
  onEditClick: (a: Allowance) => void;
}

export const AllowanceManager = ({
  uid,
  allowances,
  onChanged,
  onAddClick,
  onEditClick,
}: AllowanceManagerProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this allowance? Transactions matching its keywords will no longer be capped.')) return;
    setDeletingId(id);
    try {
      await dataService.deleteAllowance(uid, id);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-violet-100 dark:border-violet-800/30">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎛️</span>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Allowance Configurator</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {allowances.length} allowance{allowances.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-all duration-200 active:scale-95 shadow-md shadow-violet-500/30"
        >
          <Plus size={13} />
          Add New
        </button>
      </div>

      {/* Existing allowances list */}
      <div className="divide-y divide-violet-100 dark:divide-violet-800/20">
        {allowances.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No allowances configured. Add one!</div>
        )}
        {allowances.map((a) => {
          const cls = ALLOWANCE_COLOR_CLASSES[a.color] || ALLOWANCE_COLOR_CLASSES.violet;
          return (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors">
              <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl ${cls.bg}`}>{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{a.name}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full text-white font-bold uppercase ${cls.badge}`}>{a.color}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  ${a.weeklyBudget}/wk · Keywords: {a.matchKeywords.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onEditClick(a)}
                  className="p-2 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-600 dark:text-violet-400 transition-colors"
                  title="Edit allowance configuration"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors disabled:opacity-40"
                  title="Remove allowance"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {allowances.length > 0 && (
        <button
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <ChevronDown size={13} />
          Configure another allowance
        </button>
      )}
    </div>
  );
};

export default AllowanceManager;
