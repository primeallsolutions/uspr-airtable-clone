import { useRouter } from "next/navigation";
import { Rocket, Star, MoreVertical, Trash2 } from "lucide-react";
import { formatRelative, formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";
import type { BaseRecord } from "@/lib/types/dashboard";

interface BaseTileProps {
  base: BaseRecord;
  onStarToggle?: (base: BaseRecord) => void;
  onContextMenu?: (e: React.MouseEvent, base: BaseRecord) => void;
  onDeleteClick?: (base: BaseRecord) => void;
}

export const BaseTile = ({ base, onStarToggle, onContextMenu, onDeleteClick }: BaseTileProps) => {
  const router = useRouter();
  const { timezone } = useTimezone();

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if the MoreVertical button wasn't clicked
    const target = e.target as HTMLElement;
    const isButtonClick = target.closest('button');
    if (!isButtonClick) {
      router.push(`/bases/${base.id}`);
    }
  };

  // Handlers for star toggle, context menu, and delete clicks
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
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteClick?.(base);
  }

  const lastOpened = base.last_opened_at ?? base.created_at;

  return (
    <div 
      className="group relative rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm cursor-pointer"
      onClick={handleClick}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Rocket size={18} />
        </div>
        <div className="flex items-center gap-2">
          {onContextMenu && (
            <button 
              className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleContextMenuClick}
              title="More options"
            >
              <MoreVertical size={18} />
            </button>
          )}
          {onDeleteClick && (
            <button
              className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleDeleteClick}
              title="Delete base"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="mb-1 flex items-center gap-2">
        <div className="line-clamp-1 font-medium text-gray-900">{base.name}</div>
        {base.is_starred && (
          <button
            onClick={handleToggleStarClick}
            className="shrink-0 text-yellow-500 hover:text-yellow-400 cursor-pointer"
            title="Remove star"
          >
            <Star className="h-5 w-5 fill-current" />
          </button>
        )}
      </div>
      {base.description ? (
        <div className="line-clamp-2 text-sm text-gray-600">{base.description}</div>
      ) : (
        <div className="text-sm text-gray-500">No description</div>
      )}
      {lastOpened && (
        <div className="mt-2 text-xs text-gray-500">
          Opened {formatRelative(lastOpened)} · {formatInTimezone(lastOpened, timezone)}
        </div>
      )}
    </div>
  );
};
