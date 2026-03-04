import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import './PropertyEditor.css';

/**
 * PropertyEditor Component
 * 
 * Displays and edits CSS properties for selected JSX elements.
 * Allows direct manipulation of element styles in real-time.
 */
const PropertyEditor = ({
  selectedElement,
  onUpdateStyle,
  onClose,
  isOpen = false,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    sizing: true,
    spacing: true,
    colors: true,
    typography: true,
    other: false,
  });

  const [localStyles, setLocalStyles] = useState({});

  // Update local styles when selected element changes
  useEffect(() => {
    if (selectedElement?.editableStyles) {
      setLocalStyles({ ...selectedElement.editableStyles });
    }
  }, [selectedElement]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleStyleChange = (property, value) => {
    const updatedStyles = {
      ...localStyles,
      [property]: value,
    };
    setLocalStyles(updatedStyles);
    onUpdateStyle(updatedStyles);
  };

  const handleClearStyle = (property) => {
    const updatedStyles = {
      ...localStyles,
      [property]: '',
    };
    setLocalStyles(updatedStyles);
    onUpdateStyle(updatedStyles);
  };

  if (!isOpen || !selectedElement) {
    return null;
  }

  const { dataId, tagName, className, editableStyles = {} } = selectedElement;

  const propertyGroups = {
    sizing: [
      { name: 'width', label: 'Width', type: 'text', placeholder: 'e.g., 100px, 50%' },
      { name: 'height', label: 'Height', type: 'text', placeholder: 'e.g., 100px, auto' },
      { name: 'display', label: 'Display', type: 'select', options: ['', 'block', 'inline', 'inline-block', 'flex', 'grid', 'none'] },
    ],
    spacing: [
      { name: 'padding', label: 'Padding', type: 'text', placeholder: 'e.g., 10px, 10px 20px' },
      { name: 'margin', label: 'Margin', type: 'text', placeholder: 'e.g., 10px, 10px 20px' },
      { name: 'borderRadius', label: 'Border Radius', type: 'text', placeholder: 'e.g., 8px' },
    ],
    colors: [
      { name: 'color', label: 'Text Color', type: 'color' },
      { name: 'backgroundColor', label: 'Background Color', type: 'color' },
      { name: 'border', label: 'Border', type: 'text', placeholder: 'e.g., 1px solid black' },
      { name: 'opacity', label: 'Opacity', type: 'range', min: '0', max: '1', step: '0.1' },
    ],
    typography: [
      { name: 'fontSize', label: 'Font Size', type: 'text', placeholder: 'e.g., 16px, 1.5rem' },
      { name: 'fontFamily', label: 'Font Family', type: 'text', placeholder: 'e.g., Arial, sans-serif' },
      { name: 'fontWeight', label: 'Font Weight', type: 'select', options: ['', '100', '300', '400', '600', '700', '900'] },
      { name: 'textAlign', label: 'Text Align', type: 'select', options: ['', 'left', 'center', 'right', 'justify'] },
    ],
  };

  const renderPropertyInput = (property) => {
    const value = localStyles[property.name] || '';

    switch (property.type) {
      case 'color':
        return (
          <div className="flex gap-2">
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => handleStyleChange(property.name, e.target.value)}
              className="w-12 h-8 rounded cursor-pointer border border-white/10"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleStyleChange(property.name, e.target.value)}
              placeholder={property.placeholder}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        );

      case 'range':
        return (
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={property.min}
              max={property.max}
              step={property.step}
              value={value || property.min}
              onChange={(e) => handleStyleChange(property.name, e.target.value)}
              className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-400 w-8 text-right">{value || property.min}</span>
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleStyleChange(property.name, e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {property.options.map(opt => (
              <option key={opt} value={opt} className="bg-[#1a1a1a]">
                {opt || 'None'}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleStyleChange(property.name, e.target.value)}
            placeholder={property.placeholder}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        );
    }
  };

  return (
    <div className="property-editor-container">
      {/* Backdrop */}
      <div 
        className="property-editor-backdrop"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="property-editor-panel">
        {/* Header */}
        <div className="property-editor-header">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Style Editor
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {tagName}
              {className && ` ${className}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: {dataId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="property-editor-content">
          {Object.entries(propertyGroups).map(([sectionKey, properties]) => (
            <div key={sectionKey} className="property-section">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(sectionKey)}
                className="property-section-header"
              >
                <span className="text-xs font-semibold text-white capitalize">
                  {sectionKey}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSections[sectionKey] ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Properties */}
              {expandedSections[sectionKey] && (
                <div className="property-group">
                  {properties.map(property => (
                    <div key={property.name} className="property-row">
                      <label className="property-label">
                        {property.label}
                      </label>
                      <div className="property-input-wrapper">
                        {renderPropertyInput(property)}
                        {localStyles[property.name] && (
                          <button
                            onClick={() => handleClearStyle(property.name)}
                            className="property-clear-btn"
                            title="Clear style"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="property-editor-footer">
          <p className="text-xs text-gray-500 text-center">
            Changes are applied in real-time
          </p>
        </div>
      </div>
    </div>
  );
};

export default PropertyEditor;
