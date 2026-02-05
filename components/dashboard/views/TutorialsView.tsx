import { Play, Lock } from "lucide-react";
import { useState } from "react";
import { VideoPlayerModal } from "../modals/VideoPlayerModal";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

const TUTORIALS: Tutorial[] = [
  // Getting Started
  {
    id: "1",
    title: "Welcome to USPR",
    description: "An introduction to USPR and its core features. Learn what you can do with this powerful database clone.",
    category: "Getting Started",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "3:45",
    difficulty: "beginner",
  },
  {
    id: "2",
    title: "Creating Your First Workspace",
    description: "Learn how to create a new workspace to organize your projects and collaborate with team members.",
    category: "Getting Started",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "4:20",
    difficulty: "beginner",
  },
  {
    id: "3",
    title: "Inviting Team Members",
    description: "Discover how to invite collaborators to your workspace and manage their permissions.",
    category: "Getting Started",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:00",
    difficulty: "beginner",
  },

  // Bases & Tables
  {
    id: "4",
    title: "Creating Your First Base",
    description: "Step-by-step guide to creating a new base, the foundation of your data organization.",
    category: "Bases & Tables",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "4:15",
    difficulty: "beginner",
  },
  {
    id: "5",
    title: "Creating and Managing Tables",
    description: "Learn how to create tables, add records, and organize your data effectively.",
    category: "Bases & Tables",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:30",
    difficulty: "beginner",
  },
  {
    id: "6",
    title: "Understanding Field Types",
    description: "Explore different field types including text, numbers, dates, attachments, and more.",
    category: "Bases & Tables",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "7:00",
    difficulty: "intermediate",
  },

  // Data Management
  {
    id: "7",
    title: "Adding and Editing Records",
    description: "Learn how to efficiently add, edit, and delete records in your tables.",
    category: "Data Management",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:15",
    difficulty: "beginner",
  },
  {
    id: "8",
    title: "Filtering and Searching",
    description: "Master filtering and search features to quickly find the data you need.",
    category: "Data Management",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:45",
    difficulty: "beginner",
  },
  {
    id: "9",
    title: "Sorting and Organizing Data",
    description: "Learn how to sort records and organize your data for better insights.",
    category: "Data Management",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "4:30",
    difficulty: "beginner",
  },
  {
    id: "10",
    title: "Bulk Operations",
    description: "Perform bulk updates, deletes, and other operations on multiple records at once.",
    category: "Data Management",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:00",
    difficulty: "intermediate",
  },

  // Views
  {
    id: "11",
    title: "Understanding Views",
    description: "Learn about different view types and how they help you see your data from different perspectives.",
    category: "Views",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:00",
    difficulty: "beginner",
  },
  {
    id: "12",
    title: "Grid View Essentials",
    description: "Master the grid view and its powerful features for managing tabular data.",
    category: "Views",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:15",
    difficulty: "intermediate",
  },
  {
    id: "13",
    title: "Kanban View for Project Management",
    description: "Use Kanban view to visualize workflows and manage projects efficiently.",
    category: "Views",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "7:30",
    difficulty: "intermediate",
  },
  {
    id: "14",
    title: "Calendar View for Scheduling",
    description: "Organize events and deadlines using the calendar view.",
    category: "Views",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:45",
    difficulty: "intermediate",
  },

  // Automations
  {
    id: "15",
    title: "Introduction to Automations",
    description: "Learn how to automate repetitive tasks and save time with USPR automations.",
    category: "Automations",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:00",
    difficulty: "intermediate",
  },
  {
    id: "16",
    title: "Creating Your First Automation",
    description: "Step-by-step guide to creating and configuring your first automation workflow.",
    category: "Automations",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "7:20",
    difficulty: "intermediate",
  },
  {
    id: "17",
    title: "Advanced Automation Patterns",
    description: "Explore complex automation scenarios and best practices for workflow optimization.",
    category: "Automations",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "9:00",
    difficulty: "advanced",
  },

  // Collaboration
  {
    id: "18",
    title: "Sharing Bases with Your Team",
    description: "Learn how to share bases with team members and control their access levels.",
    category: "Collaboration",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "5:30",
    difficulty: "intermediate",
  },
  {
    id: "19",
    title: "Comments and Collaboration",
    description: "Work together by adding comments and collaborating on records in real-time.",
    category: "Collaboration",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "4:45",
    difficulty: "beginner",
  },
  {
    id: "20",
    title: "Managing Permissions",
    description: "Understand permission levels and how to control who can do what in your workspace.",
    category: "Collaboration",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:30",
    difficulty: "intermediate",
  },

  // Advanced Features
  {
    id: "21",
    title: "Creating Relationships",
    description: "Link related data across tables using relationships and lookups.",
    category: "Advanced Features",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "7:00",
    difficulty: "advanced",
  },
  {
    id: "22",
    title: "Using Formulas",
    description: "Master formulas to calculate values and manipulate data automatically.",
    category: "Advanced Features",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "9:15",
    difficulty: "advanced",
  },
  {
    id: "23",
    title: "Exporting and Importing Data",
    description: "Learn how to export your data and import from external sources.",
    category: "Advanced Features",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example_image.svg/960px-Example_image.svg.png",
    videoUrl: "https://www.youtube.com/embed/wDchsz8nmbo",
    duration: "6:45",
    difficulty: "intermediate",
  },
];

const CATEGORIES = [
  "Getting Started",
  "Bases & Tables",
  "Data Management",
  "Views",
  "Automations",
  "Collaboration",
  "Advanced Features",
];

const getDifficultyColor = (difficulty: "beginner" | "intermediate" | "advanced") => {
  switch (difficulty) {
    case "beginner":
      return "bg-green-100 text-green-800";
    case "intermediate":
      return "bg-blue-100 text-blue-800";
    case "advanced":
      return "bg-purple-100 text-purple-800";
  }
};

export const TutorialsView = () => {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Getting Started");

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Tutorials</h1>
        <p className="text-gray-600">Learn how to use USPR with our comprehensive video guides</p>
      </div>

      {/* Tutorial Categories */}
      <div className="space-y-8">
        {CATEGORIES.map((category) => {
          const categoryTutorials = TUTORIALS.filter((t) => t.category === category);
          const isExpanded = expandedCategory === category;

          return (
            <div key={category}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full flex items-center justify-between mb-4 group"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition">
                    {category}
                  </h2>
                  <span className="bg-gray-200 text-gray-700 text-sm px-2 py-1 rounded">
                    {categoryTutorials.length}
                  </span>
                </div>
                <div
                  className={`text-gray-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </div>
              </button>

              {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                  {categoryTutorials.map((tutorial) => (
                    <div
                      key={tutorial.id}
                      onClick={() => setSelectedTutorial(tutorial)}
                      className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white hover:shadow-lg hover:border-blue-300 transition-all"
                    >
                      {/* Thumbnail */}
                      <div className="relative bg-gray-900 h-40 flex items-center justify-center overflow-hidden">
                        <img src={tutorial.thumbnailUrl} alt={tutorial.title} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-20 group-hover:opacity-30 transition"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTutorial(tutorial);
                          }}
                          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg group-hover:scale-110 transition-transform"
                          aria-label="Play video"
                        >
                          <Play size={24} fill="currentColor" />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition line-clamp-2">
                            {tutorial.title}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {tutorial.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(
                                tutorial.difficulty
                              )}`}
                            >
                              {tutorial.difficulty.charAt(0).toUpperCase() +
                                tutorial.difficulty.slice(1)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{tutorial.duration}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Video Player Modal */}
      {selectedTutorial && (
        <VideoPlayerModal
          tutorial={selectedTutorial}
          onClose={() => setSelectedTutorial(null)}
        />
      )}
    </>
  );
};
