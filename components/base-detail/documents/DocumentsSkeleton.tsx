// Deterministic width patterns for skeleton loading
const folderWidths = [92, 85, 98, 88, 95, 90, 87, 96, 84, 91];
const docWidths1 = [75, 82, 68, 90, 72, 85, 78, 88, 70, 80];
const docWidths2 = [50, 45, 55, 48, 52, 46, 58, 44, 56, 49];

export const FolderSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-lg bg-gray-200 animate-pulse"
          style={{ width: `${folderWidths[i % folderWidths.length]}%` }}
        />
      ))}
    </div>
  );
};

export const DocumentSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${docWidths1[i % docWidths1.length]}%` }} />
            <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${docWidths2[i % docWidths2.length]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const PreviewSkeleton = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-gray-50 flex items-center justify-center">
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
};

