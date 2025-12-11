"use client";
import { useEffect, useRef, useState } from "react";

export interface ContextMenuOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  options: ContextMenuOption[];
  position: { x: number; y: number };
  onClose: () => void;
  isVisible: boolean;
}

export function ContextMenu({ options, position, onClose, isVisible }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isVisible, onClose]);

  // Calculate optimal position to prevent overflow
  const getOptimalPosition = () => {
    // Note: There used to be a check for menuRef.current here, but there are no cases where an early return was necessary.
    // Removing it allows for the position calculation to always run, preventing the menu from rendering off-screen.
    
    const menuWidth = 200; // min-w-[200px]
    const menuHeight = options.length * 40 + 16; // Approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = position.x;
    let top = position.y;
    
    // Adjust horizontal position if menu would overflow right edge
    if (left + menuWidth > viewportWidth - 10) {
      left = position.x - menuWidth;
    }
    
    // Ensure menu doesn't go off the left edge
    if (left < 10) {
      left = 10;
    }
    
    // Adjust vertical position if menu would overflow bottom edge
    if (top + menuHeight > viewportHeight - 10) {
      top = position.y - menuHeight;
    }
    
    // Ensure menu doesn't go off the top edge
    if (top < 10) {
      top = 10;
    }
    
    return { left, top };
  };

  if (!isVisible) return null;

  const optimalPosition = getOptimalPosition();

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px] z-50"
      style={{
        left: optimalPosition.left,
        top: optimalPosition.top,
      }}
    >
      {options.map((option, index) => (
        <div key={option.id}>
          {option.separator && index > 0 && (
            <div className="border-t border-gray-100 my-1" />
          )}
          <button
            onClick={() => {
              if (!option.disabled) {
                option.onClick();
                onClose();
              }
            }}
            disabled={option.disabled}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors ${
              option.disabled 
                ? "text-gray-400 cursor-not-allowed" 
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            {option.icon && (
              <span className="w-4 h-4 flex-shrink-0">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// Hook for managing context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    type?: 'base' | 'field' | 'table' | 'record';
    data?: unknown;
    tableId?: string;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
  });

  const showContextMenu = (event: React.MouseEvent, type?: 'base' | 'field' | 'table' | 'record', data?: unknown) => {
    event.preventDefault();
    event.stopPropagation();
    
    // For field context menus, position relative to the button that was clicked
    let x = event.clientX;
    let y = event.clientY;
    
    if (type === 'field') {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      
      // Position the menu to the left of the button if it's near the right edge
      const viewportWidth = window.innerWidth;
      if (rect.right + 200 > viewportWidth - 20) {
        x = rect.left - 200;
      } else {
        x = rect.right;
      }
      
      // Position below the button
      y = rect.bottom + 5;
    }
    
    setContextMenu({
      isVisible: true,
      position: { x, y },
      type,
      data,
    });
  };

  const hideContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  return {
    contextMenu,
    setContextMenu,
    showContextMenu,
    hideContextMenu,
  };
}

