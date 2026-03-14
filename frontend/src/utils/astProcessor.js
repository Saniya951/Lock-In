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

function isIdentifierStart(char) {
  return /[A-Za-z]/.test(char);
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function scanJsxOpeningTags(content) {
  const tags = [];

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '<' || !isIdentifierStart(content[index + 1] || '')) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < content.length && /[A-Za-z0-9.-]/.test(content[cursor])) {
      cursor += 1;
    }

    const tagName = content.slice(index + 1, cursor);
    let braceDepth = 0;
    let quoteChar = null;
    let tagEnd = -1;

    for (; cursor < content.length; cursor += 1) {
      const char = content[cursor];
      const previousChar = content[cursor - 1];

      if (quoteChar) {
        if (char === quoteChar && previousChar !== '\\') {
          quoteChar = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        quoteChar = char;
        continue;
      }

      if (char === '{') {
        braceDepth += 1;
        continue;
      }

      if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }

      if (char === '>' && braceDepth === 0) {
        tagEnd = cursor;
        break;
      }
    }

    if (tagEnd === -1) {
      continue;
    }

    const rawAttributes = content.slice(index + 1 + tagName.length, tagEnd);
    const isSelfClosing = /\/\s*$/.test(rawAttributes);
    const attributes = isSelfClosing ? rawAttributes.replace(/\/\s*$/, '') : rawAttributes;

    tags.push({
      start: index,
      end: tagEnd + 1,
      tagName,
      attributes,
      isSelfClosing,
      line: getLineNumber(content, index),
    });

    index = tagEnd;
  }

  return tags;
}

/**
 * Simple scanner-based fallback for JSX ID injection
 * Used when Babel is not available
 */
function regexBasedIdInjection(jsxContent, filePath) {
  const mapping = {};
  let counter = 0;

  const tags = scanJsxOpeningTags(jsxContent);
  let modifiedContent = '';
  let lastIndex = 0;

  tags.forEach((tag) => {
    const { start, end, tagName, attributes, isSelfClosing, line } = tag;
    const id = `uid-${++counter}`;
    const cleanedAttributes = attributes;
    
    // Store mapping info
    mapping[id] = {
      file: filePath,
      tagName,
      attributes: cleanedAttributes || '',
      line,
    };

    // Skip if already has data-id
    if (attributes && attributes.includes('data-id=')) {
      modifiedContent += jsxContent.slice(lastIndex, end);
      lastIndex = end;
      return;
    }

    // Inject data-id
    const attrWithId = cleanedAttributes.trim()
      ? `${cleanedAttributes} data-id="${id}"`
      : ` data-id="${id}"`;

    const replacement = isSelfClosing
      ? `<${tagName}${attrWithId} />`
      : `<${tagName}${attrWithId}>`;

    modifiedContent += jsxContent.slice(lastIndex, start);
    modifiedContent += replacement;
    lastIndex = end;
  });

  if (lastIndex === 0) {
    modifiedContent = jsxContent;
  } else {
    modifiedContent += jsxContent.slice(lastIndex);
  }

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
  return scanJsxOpeningTags(content).map((tag) => ({
    tagName: tag.tagName,
    attributes: tag.attributes || '',
    position: tag.start,
    line: tag.line,
  }));
}
