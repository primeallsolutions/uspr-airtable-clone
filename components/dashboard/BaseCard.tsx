import { useRouter } from "next/navigation";
import { Rocket, Star, MoreVertical } from "lucide-react";
import { formatRelative, formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";
import type { BaseRecord } from "@/lib/types/dashboard";
import type { CollectionView } from "@/lib/types/dashboard";

interface BaseCardProps {
  base: BaseRecord;
  view: CollectionView;
  onStarToggle?: (base: BaseRecord) => void;
  onContextMenu?: (e: React.MouseEvent, base: BaseRecord) => void;
}

export const BaseCard = ({ base, view, onStarToggle, onContextMenu }: BaseCardProps) => {
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

  const lastOpened = base.last_opened_at ?? base.created_at;

  if (view === 'list') {
    return (
      <div
        key={base.id}
        className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <Rocket className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{base.name}</h3>
            <button
              onClick={handleToggleStarClick}
              className="shrink-0 text-yellow-500 hover:text-yellow-400 cursor-pointer"
              title="Remove star"
            >
              {base.is_starred ? (
                <Star className="h-4 w-4 fill-current" />
              ) : (
                <Star className="h-4 w-4 hover:fill-current hover:text-yellow-400" />
              )}
            </button>
          </div>
          <p className="text-sm text-gray-600 line-clamp-1">
            {base.description || 'No description'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>Opened {formatRelative(lastOpened)}</span>
        </div>
        
        <button
          onClick={handleContextMenuClick}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
          title="More options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      key={base.id}
      className="group p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <Rocket className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStarClick}
            className="shrink-0 text-yellow-500 hover:text-yellow-400 cursor-pointer"
            title="Remove star"
          >
            {base.is_starred ? (
              <Star className="h-5 w-5 fill-current" />
            ) : (
              <Star className="h-5 w-5 text-yellow-400 hover:fill-current hover:text-yellow-400" />
            )}
          </button>
          <button
            onClick={handleContextMenuClick}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <h3 className="font-semibold text-gray-900 mb-2">{base.name}</h3>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
        {base.description || 'No description'}
      </p>
      
      <div className="flex items-center gap-1 text-xs text-gray-500 pt-4 border-t border-gray-100">
        <span>Opened {formatRelative(lastOpened)}</span>
        <span>·</span>
        <span>{formatInTimezone(lastOpened, timezone)}</span>
      </div>
    </div>
  );
};
