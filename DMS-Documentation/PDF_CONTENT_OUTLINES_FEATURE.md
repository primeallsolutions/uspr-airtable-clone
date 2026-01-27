# PDF Content Outlines Feature

## Overview
Added a new feature to the PDF Editor that displays thin outline indicators around all content blocks (both existing PDF content and user-added elements) to help users visualize boundaries and structure.

## Features Implemented

### 1. Content Outline Visualization
- **Default State**: Outlines are enabled by default when opening the PDF editor
- **Visual Indicators**: Thin dashed borders around all content blocks
- **Color Coding**:
  - Green (`#4ade80`) - Text content blocks
  - Blue (`#60a5fa`) - Annotation blocks (highlights, text annotations, signatures)
  - Red (`#f87171`) - Other content types (future expansion)

### 2. Toggle Control
- **Toolbar Button**: New outline icon button in the toolbar
- **State Persistence**: Remembers user preference during session
- **Visual Feedback**: Button highlights when outlines are active (blue background)

### 3. Dynamic Content Detection
- **Automatic Detection**: Identifies text blocks from PDF content extraction
- **Annotation Integration**: Includes all user-created annotations (highlights, text, signatures)
- **Real-time Updates**: Content outlines update when annotations are added/removed
- **Per-page Management**: Separate outline data for each PDF page

### 4. Performance Optimizations
- **Efficient Rendering**: Outlines rendered on separate layer with proper z-index (zIndex: 4)
- **Non-interactive**: Outlines don't interfere with mouse events or editing
- **Memory Management**: Clean state management with proper cleanup

## Technical Implementation

### State Management
```typescript
const [showContentOutlines, setShowContentOutlines] = useState(true);
const [contentBlocks, setContentBlocks] = useState<Map<number, Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'text' | 'image' | 'annotation';
  id: string;
}>>>(new Map());
```

### Content Block Detection
- **Text Extraction**: Uses PDF.js `getTextContent()` to identify text positions
- **Annotation Tracking**: Monitors all annotation additions/removals
- **Coordinate Mapping**: Properly maps PDF coordinates to viewport coordinates

### Rendering Layer
```jsx
{/* Content Outlines Layer */}
{showContentOutlines && contentBlocks.get(currentPage) && (
  <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 4 }}>
    {contentBlocks.get(currentPage)!.map((block, idx) => (
      <div
        key={`${block.id}-${idx}`}
        className="absolute border border-dashed"
        style={{
          left: block.x * zoom,
          top: block.y * zoom,
          width: block.width * zoom,
          height: block.height * zoom,
          borderColor: getColorByType(block.type),
          borderWidth: '1px',
          opacity: 0.7,
          pointerEvents: 'none'
        }}
      />
    ))}
  </div>
)}
```

## User Experience Benefits

### Visual Clarity
- **Boundary Awareness**: Users can easily see where content blocks begin and end
- **Structure Understanding**: Helps visualize document layout and organization
- **Editing Precision**: Makes it easier to target specific content areas

### Workflow Enhancement
- **Content Discovery**: Quickly identify editable regions
- **Annotation Placement**: Better placement of highlights and annotations
- **Layout Analysis**: Understand document structure before making changes

### Accessibility
- **Visual Aid**: Helpful for users who need visual guidance
- **Non-intrusive**: Can be toggled off when not needed
- **Consistent Feedback**: Clear visual indication of outline status

## Usage Instructions

1. **Default Behavior**: Outlines appear automatically when PDF editor opens
2. **Toggle On/Off**: Click the outline icon button in the toolbar
3. **Visual Confirmation**: Status bar shows "Outlines: ON/OFF"
4. **Interactive Editing**: Outlines don't interfere with normal editing operations

## Future Enhancements

### Planned Features
- **Customizable Colors**: Allow users to choose outline colors
- **Outline Thickness**: Adjustable border width options
- **Opacity Control**: Configurable transparency levels
- **Filter Options**: Show/hide specific content types
- **Export Outlines**: Save outline data for reference

### Technical Improvements
- **Image Detection**: Identify and outline embedded images
- **Table Recognition**: Special handling for tabular content
- **Performance Optimization**: Virtualized rendering for large documents
- **Persistent Settings**: Save user preferences across sessions

## Testing Scenarios

### Basic Functionality
- ✅ Outlines appear by default
- ✅ Toggle button works correctly
- ✅ Different content types show appropriate colors
- ✅ Outlines scale properly with zoom

### Edge Cases
- ✅ Works with single-page and multi-page documents
- ✅ Handles documents with no text content
- ✅ Maintains performance with many annotations
- ✅ Proper cleanup when closing editor

### Integration
- ✅ Works alongside existing editing features
- ✅ Doesn't interfere with text selection
- ✅ Compatible with all annotation types
- ✅ Preserves existing functionality

## Known Limitations

1. **Text Accuracy**: Outline precision depends on PDF text extraction quality
2. **Complex Layouts**: May not perfectly capture all content boundaries in complex documents
3. **Performance**: Very large documents with thousands of content blocks may impact rendering
4. **Image Content**: Currently only detects text and annotations, not embedded images

## Troubleshooting

### Common Issues
- **Missing Outlines**: Ensure the toggle is enabled and document has loaded completely
- **Incorrect Positions**: Refresh the document view or reopen the editor
- **Performance Issues**: Disable outlines for very large documents
- **Color Confusion**: Refer to the color legend in the documentation

### Debug Information
- Check browser console for any error messages
- Verify that `contentBlocks` state is populating correctly
- Confirm PDF text extraction is working properly