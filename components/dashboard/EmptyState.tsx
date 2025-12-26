import { Plus, Rocket, Share2, Star } from "lucide-react";

interface EmptyStateProps {
  type: 'today' | 'earlier' | 'workspace' | 'starred' | 'shared';
  onCreateBase?: () => void;
}

export const EmptyState = ({ type, onCreateBase }: EmptyStateProps) => {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'today':
        return {
          message: "No bases opened today",
          className: "rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600"
        };
      
      case 'earlier':
        return {
          message: "No earlier databases",
          className: "rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600"
        };
      
      case 'workspace':
        return {
          icon: <Rocket className="h-6 w-6 text-gray-400" />,
          title: "No bases yet",
          message: "Get started by creating your first base.",
          showButton: true,
          className: "rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"
        };
      
      case 'starred':
        return {
          icon: <Star className="mx-auto h-12 w-12 text-gray-400" />,
          title: "No starred bases yet",
          message: "Star your favorite bases to see them here.",
          className: "col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"
        };
        
      case 'shared':
        return {
          icon: <Share2 className="mx-auto h-12 w-12 text-gray-400" />,
          title: "No shared bases yet",
          message: "If someone shares a workspace with you, its bases will appear here.",
          className: "col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"
        };
      
      default:
        return {
          message: "No items found",
          className: "rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600"
        };
    }
  };

  const content = getEmptyStateContent();

  if (type === 'today' || type === 'earlier') {
    return (
      <div className={content.className}>
        {content.message}
      </div>
    );
  }

  return (
    <div className={content.className}>
      {content.icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
          {content.icon}
        </div>
      )}
      {content.title && <h3 className="mt-4 text-sm font-medium text-gray-900">{content.title}</h3>}
      {content.message && <p className="mt-1 text-sm text-gray-500">{content.message}</p>}
      {content.showButton && onCreateBase && (
        <div className="mt-6">
          <button
            onClick={onCreateBase}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create base
          </button>
        </div>
      )}
    </div>
  );
};
