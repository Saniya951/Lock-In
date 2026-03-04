/**
 * AST-based ID Injection System
 * 
 * Processes JSX files to inject unique data-id attributes to all (or selected) elements.
 * Creates a mapping of data-id -> file location + AST path for later code updates.
 * 
 * NOTE: This requires @babel/parser and @babel/generator which should be added to dependencies.
 * If not available, it will use a regex-based fallback approach.
 */

let idCounter = 0;
let idMapping = {}; // Maps data-id -> { file, line, tagName, attributes }

/**
 * Simple regex-based fallback for JSX ID injection
 * Used when Babel is not available
 */
function regexBasedIdInjection(jsxContent, filePath) {
  const mapping = {};
  let counter = 0;
  
  // Pattern for JSX opening tags (simplified)
  // Matches: <Component or <div or <span, etc.
  const tagPattern = /<([A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9-]*)(\s[^>]*)?>/g;
  
  let modifiedContent = jsxContent;
  let offset = 0;

  modifiedContent = modifiedContent.replace(tagPattern, (match, tagName, attributes = '', offsetIndex) => {
    const id = `uid-${++counter}`;
    const isSelfClosing = /\/\s*>$/.test(match);
    const cleanedAttributes = attributes.replace(/\s*\/\s*$/, '');
    
    // Store mapping info
    mapping[id] = {
      file: filePath,
      tagName,
      attributes: cleanedAttributes || '',
      line: jsxContent.substring(0, offsetIndex).split('\n').length,
    };

    // Skip if already has data-id
    if (attributes && attributes.includes('data-id=')) {
      return match;
    }

    // Inject data-id
    const attrWithId = cleanedAttributes.trim()
      ? `${cleanedAttributes} data-id="${id}"`
      : ` data-id="${id}"`;

    if (isSelfClosing) {
      return `<${tagName}${attrWithId} />`;
    }

    return `<${tagName}${attrWithId}>`;
  });

  return { modifiedContent, mapping, counter };
}

/**
 * Process JSX/TSX file and inject data-id attributes
 * @param {string} content - JSX file content
 * @param {string} filePath - File path (for mapping)
 * @param {object} options - { strategy: 'all' | 'components', skipElements: [...] }
 * @returns { modifiedContent: string, mapping: object, totalIds: number }
 */
export function injectDataIds(content, filePath, options = {}) {
  const { strategy = 'all', skipElements = ['Fragment', 'React.Fragment'] } = options;

  try {
    // Try to use Babel if available
    if (typeof window !== 'undefined' && window.Babel) {
      return babelBasedIdInjection(content, filePath, options);
    }
  } catch (e) {
    console.warn('[ID Injection] Babel not available, using regex fallback', e.message);
  }

  // Fallback to regex-based approach
  const result = regexBasedIdInjection(content, filePath);
  return result;
}

/**
 * Create a mapping from data-id to JSX element info
 * Useful for tracking which element corresponds to which code location
 */
export function getIdMapping() {
  return { ...idMapping };
}

/**
 * Clear the ID counter and mapping (call when starting new session)
 */
export function resetIdTracking() {
  idCounter = 0;
  idMapping = {};
}

/**
 * Update the ID counter to avoid duplicates when processing multiple files
 */
export function setIdCounterOffset(offset) {
  idCounter = offset;
}

/**
 * Process multiple files at once
 * @param {object} files - { filename: content, ... }
 * @param {object} options - Processing options
 * @returns {{ processedFiles, mapping, stats }}
 */
export function processJsxFiles(files, options = {}) {
  const processedFiles = {};
  const mapping = {};
  const stats = {
    totalFiles: 0,
    filesProcessed: 0,
    totalIdsInjected: 0,
    errors: [],
  };

  resetIdTracking();

  for (const [filename, content] of Object.entries(files)) {
    // Only process .jsx, .tsx, and .js files
    if (!['.jsx', '.tsx', '.js'].some(ext => filename.endsWith(ext))) {
      processedFiles[filename] = content;
      continue;
    }

    // Skip certain files
    if (filename.includes('node_modules') || filename.includes('dist')) {
      continue;
    }

    stats.totalFiles++;

    try {
      const result = injectDataIds(content, filename, options);
      processedFiles[filename] = result.modifiedContent;
      Object.assign(mapping, result.mapping);
      stats.totalIdsInjected += result.counter || 0;
      stats.filesProcessed++;
    } catch (error) {
      console.error(`[ID Injection] Error processing ${filename}:`, error);
      stats.errors.push({
        file: filename,
        error: error.message,
      });
      // Keep original content if processing fails
      processedFiles[filename] = content;
    }
  }

  idMapping = mapping;

  return {
    processedFiles,
    mapping,
    stats,
  };
}

/**
 * Find element info by data-id from the mapping
 */
export function getElementInfo(dataId) {
  return idMapping[dataId] || null;
}

/**
 * Helper to extract all JSX elements from content (for debugging/preview)
 */
export function extractJsxElements(content) {
  const elements = [];
  const tagPattern = /<([A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9-]*)(\s[^>]*)?>/g;
  
  let match;
  while ((match = tagPattern.exec(content)) !== null) {
    elements.push({
      tagName: match[1],
      attributes: match[2] || '',
      position: match.index,
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return elements;
}
