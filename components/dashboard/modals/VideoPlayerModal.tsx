import { X, Download, Share2 } from "lucide-react";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface VideoPlayerModalProps {
  tutorial: Tutorial;
  onClose: () => void;
}

export const VideoPlayerModal = ({ tutorial, onClose }: VideoPlayerModalProps) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-blue-100 text-blue-800";
      case "advanced":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white text-gray-600 hover:bg-gray-100 transition"
          aria-label="Close modal"
        >
          <X size={24} />
        </button>

        {/* Video Player */}
        <div className="relative bg-black aspect-video overflow-hidden">
          <iframe
            width="100%"
            height="100%"
            src={tutorial.videoUrl}
            title={tutorial.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2 gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{tutorial.title}</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-600">{tutorial.category}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-600">{tutorial.duration}</span>
                  <span className="text-gray-300">•</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(
                      tutorial.difficulty
                    )}`}
                  >
                    {tutorial.difficulty.charAt(0).toUpperCase() + tutorial.difficulty.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-gray-700 mb-6">{tutorial.description}</p>
        </div>
      </div>
    </div>
  );
};
