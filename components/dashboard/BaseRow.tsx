import Link from "next/link";
import { Rocket, Star, MoreVertical, Trash2 } from "lucide-react";
import { formatRelative, formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";
import type { BaseRecord } from "@/lib/types/dashboard";

interface BaseRowProps {
  base: BaseRecord;
  // New: Star and Context Menu handlers
  onStarToggle?: (base: BaseRecord) => void;
  onContextMenu?: (e: React.MouseEvent, base: BaseRecord) => void;
  onDeleteClick?: (base: BaseRecord) => void;
}

export const BaseRow = ({ base, onStarToggle, onContextMenu, onDeleteClick }: BaseRowProps) => {
  const { timezone } = useTimezone();
  const lastOpened = base.last_opened_at ?? base.created_at;

  // Handlers for star toggle and context menu clicks
  const handleToggleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStarToggle?.(base);
  }
  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, base);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-gray-100 px-4 py-3 first:border-t-0 transition hover:bg-gray-50">
      <Link href={`/bases/${base.id}`} className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
          <Rocket size={16} />
        </div>
        <div className="truncate text-sm font-medium text-gray-900">{base.name}</div>
        {base.is_starred && <Star className="w-5 h-5 text-yellow-500 hover:text-yellow-400 fill-current" onClick={handleToggleStarClick} />}
      </Link>
      <div className="flex items-center justify-end gap-3 text-xs text-gray-500">
        <div>
          Opened {formatRelative(lastOpened)} · {formatInTimezone(lastOpened, timezone, { hour: 'numeric', minute: '2-digit' })}
        </div>
        {onContextMenu && ( /* copied from BaseTile.tsx */
          <button 
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            onClick={handleContextMenuClick}
            title="More options"
          >
            <MoreVertical size={18} />
          </button>
        )}
        {onDeleteClick && (
          <button
            className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
            title="Delete base"
            onClick={() => onDeleteClick(base)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
