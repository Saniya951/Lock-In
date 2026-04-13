/**
 * JSX Code Updater
 * 
 * Handles modification of JSX code based on element selector (data-id)
 * and style properties. Updates inline styles or style attributes in the code.
 */

/**
 * Convert CSS property name to camelCase if needed
 * e.g., "background-color" -> "backgroundColor"
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to CSS property name
 * e.g., "backgroundColor" -> "background-color"
 */
function toCssProperty(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Parse inline style string to object
 * e.g., "color: red; font-size: 16px;" -> { color: 'red', fontSize: '16px' }
 */
function parseStyleString(styleStr) {
  if (!styleStr) return {};
  
  const styles = {};
  styleStr.split(';').forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      styles[toCamelCase(prop)] = value;
    }
  });
  
  return styles;
}

/**
 * Parse JSX style object string to object
 * e.g., 'padding: "12px", opacity: 1' -> { padding: '12px', opacity: 1 }
 */
function parseJsxStyleObject(styleObjStr) {
  if (!styleObjStr) return {};

  const styles = {};
  styleObjStr
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(entry => {
      const colonIndex = entry.indexOf(':');
      if (colonIndex === -1) return;

      const rawKey = entry.slice(0, colonIndex).trim();
      const rawValue = entry.slice(colonIndex + 1).trim();
      if (!rawKey || !rawValue) return;

      let value = rawValue;
      if (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        value = rawValue.slice(1, -1);
      } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
        value = Number(rawValue);
      }

      styles[toCamelCase(rawKey)] = value;
    });

  return styles;
}

/**
 * Convert style object to CSS string
 * e.g., { color: 'red', fontSize: '16px' } -> "color: red; font-size: 16px;"
 */
function styleObjectToString(styleObj) {
  return Object.entries(styleObj)
    .map(([key, value]) => `${toCssProperty(key)}: ${value}`)
    .join('; ')
    .trim();
}

/**
 * Convert style object to JSX style object string
 * e.g., { color: 'red', opacity: 1 } -> 'color: "red", opacity: 1'
 */
function styleObjectToJsxString(styleObj) {
  return Object.entries(styleObj)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `${key}: ${value}`;
      }

      if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
        return `${key}: ${Number(value)}`;
      }

      const escaped = String(value).replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    })
    .join(', ')
    .trim();
}

/**
 * Regex-based approach to update JSX element styles
 * Finds the element by data-id and updates its style attribute or inline styles
 */
function updateStyleViaRegex(jsxContent, dataId, styleUpdates) {
  // Find the opening tag with matching data-id
  const dataIdPattern = new RegExp(
    `<([A-Za-z][\\w-]*)([^>]*?)data-id=["']${dataId}["']([^>]*)>`,
    'g'
  );

  return jsxContent.replace(dataIdPattern, (match, tagName, before, after) => {
    // Combine before and after to get full attributes
    const allAttributes = before + ` data-id="${dataId}"` + after;
    const isSelfClosing = /\/\s*>$/.test(match);

    // Check if there's an existing style attribute (JSX object first)
    const jsxStylePattern = /style=\{\{([\s\S]*?)\}\}/;
    const htmlStylePattern = /style=["']([^"']*)["']/;
    const jsxStyleMatch = jsxStylePattern.exec(allAttributes);
    const htmlStyleMatch = htmlStylePattern.exec(allAttributes);

    let newAttributes = allAttributes;
    let existingStyles = {};

    if (jsxStyleMatch) {
      existingStyles = parseJsxStyleObject(jsxStyleMatch[1]);
    } else if (htmlStyleMatch) {
      existingStyles = parseStyleString(htmlStyleMatch[1]);
    }

    if (jsxStyleMatch || htmlStyleMatch) {
      // Merge with updates (updates override)
      const mergedStyles = {
        ...existingStyles,
        ...styleUpdates,
      };

      // Remove empty style values
      Object.keys(mergedStyles).forEach(key => {
        const value = mergedStyles[key];
        if (value === '' || value === null || value === undefined) {
          delete mergedStyles[key];
        }
      });

      // Generate new JSX style object string
      const newStyleString = styleObjectToJsxString(mergedStyles);

      // Replace style attribute
      if (jsxStyleMatch) {
        newAttributes = allAttributes.replace(
          jsxStylePattern,
          `style={{ ${newStyleString} }}`
        );
      } else {
        newAttributes = allAttributes.replace(
          htmlStylePattern,
          `style={{ ${newStyleString} }}`
        );
      }
    } else {
      // Create new JSX style attribute
      const newStyleString = styleObjectToJsxString(styleUpdates);
      if (newStyleString) {
        newAttributes = allAttributes.replace(
          `data-id="${dataId}"`,
          `data-id="${dataId}" style={{ ${newStyleString} }}`
        );
      }
    }

    return isSelfClosing
      ? `<${tagName}${newAttributes.replace(/\s*\/\s*$/, '')} />`
      : `<${tagName}${newAttributes}>`;
  });
}

/**
 * Convert browser computed style names to CSS inline style names
 * Handles both camelCase and CSS property names
 */
function normalizeStyleProperty(prop, value) {
  const styleMap = {
    color: 'color',
    backgroundColor: 'backgroundColor',
    fontSize: 'fontSize',
    padding: 'padding',
    margin: 'margin',
    width: 'width',
    height: 'height',
    fontFamily: 'fontFamily',
    fontWeight: 'fontWeight',
    borderRadius: 'borderRadius',
    opacity: 'opacity',
    textAlign: 'textAlign',
    display: 'display',
    border: 'border',
  };

  // Normalize to camelCase
  const normalizedProp = toCamelCase(prop);
  return {
    key: styleMap[normalizedProp] || normalizedProp,
    value: value,
  };
}

/**
 * Update JSX code with new styles for an element identified by data-id
 * @param {string} jsxContent - Original JSX code
 * @param {string} dataId - Element's data-id attribute
 * @param {object} styleUpdates - { propertyName: newValue, ... }
 * @returns {string} Updated JSX code
 */
export function updateElementStyles(jsxContent, dataId, styleUpdates) {
  if (!dataId || !styleUpdates || Object.keys(styleUpdates).length === 0) {
    return jsxContent;
  }

  // Normalize style updates to camelCase
  const normalizedUpdates = {};
  Object.entries(styleUpdates).forEach(([prop, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      const { key, value: val } = normalizeStyleProperty(prop, value);
      normalizedUpdates[key] = val;
    }
  });

  // Apply updates using regex
  try {
    return updateStyleViaRegex(jsxContent, dataId, normalizedUpdates);
  } catch (error) {
    console.error('[Code Updater] Error updating styles:', error);
    return jsxContent;
  }
}

/**
 * Add a CSS class to an element (simpler alternative to inline styles)
 * @param {string} jsxContent - JSX code
 * @param {string} dataId - Element's data-id
 * @param {string} className - Class to add
 */
export function addClassToElement(jsxContent, dataId, className) {
  const pattern = new RegExp(
    `<(\\w+)([^>]*?)data-id=["']${dataId}["']([^>]*)>`,
    'g'
  );

  return jsxContent.replace(pattern, (match, tagName, before, after) => {
    const allAttributes = before + ` data-id="${dataId}"` + after;
    
    // Check for existing className
    const classPattern = /className=["']([^"']*)["']/;
    const classMatch = classPattern.exec(allAttributes);

    let newAttributes = allAttributes;

    if (classMatch && !classMatch[1].includes(className)) {
      // Add to existing class
      newAttributes = allAttributes.replace(
        classPattern,
        `className="${classMatch[1]} ${className}"`
      );
    } else if (!classMatch) {
      // Create new className
      newAttributes = allAttributes.replace(
        `data-id="${dataId}"`,
        `data-id="${dataId}" className="${className}"`
      );
    }

    return `<${tagName}${newAttributes}>`;
  });
}

/**
 * Get all elements with data-id and their styles from JSX content
 * Useful for preview or debugging
 */
export function extractElementsWithIds(jsxContent) {
  const elements = [];
  const pattern = /<([A-Za-z][\w-]*)([^>]*?)data-id=["']([^"']+)["']([^>]*)>/g;
  
  let match;
  while ((match = pattern.exec(jsxContent)) !== null) {
    const [fullMatch, tagName, before, dataId, after] = match;
    const allAttributes = before + ` data-id="${dataId}"` + after;

    // Extract style
    const jsxStyleMatch = /style=\{\{([\s\S]*?)\}\}/.exec(allAttributes);
    const htmlStyleMatch = /style=["']([^"']*)["']/.exec(allAttributes);
    const style = jsxStyleMatch
      ? parseJsxStyleObject(jsxStyleMatch[1])
      : htmlStyleMatch
        ? parseStyleString(htmlStyleMatch[1])
        : {};

    elements.push({
      dataId,
      tagName,
      style,
      position: match.index,
    });
  }

  return elements;
}

/**
 * Batch update multiple elements' styles
 * @param {string} jsxContent - JSX code
 * @param {object} updates - { dataId: { prop: value, ... }, ... }
 */
export function batchUpdateStyles(jsxContent, updates) {
  let result = jsxContent;

  Object.entries(updates).forEach(([dataId, styleUpdates]) => {
    result = updateElementStyles(result, dataId, styleUpdates);
  });

  return result;
}

/**
 * Remove all data-id attributes from JSX (for cleanup/export)
 */
export function removeDataIds(jsxContent) {
  return jsxContent.replace(/\s?data-id=["'][^"']*["']/g, '');
}

/**
 * Validate if JSX content is syntactically correct
 * Simple check - looks for balanced tags
 */
export function validateJsx(jsxContent) {
  const openingTags = (jsxContent.match(/<\w+/g) || []).length;
  const closingTags = (jsxContent.match(/<\/\w+>/g) || []).length;
  
  // Self-closing tags like <br/> count as both
  const selfClosing = (jsxContent.match(/<\w+[^>]*\/>/g) || []).length;

  return {
    isBalanced: Math.abs(openingTags - closingTags) <= selfClosing,
    openingTags,
    closingTags,
    selfClosingTags: selfClosing,
  };
}
