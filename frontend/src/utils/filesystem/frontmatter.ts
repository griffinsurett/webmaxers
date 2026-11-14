// src/utils/filesystem/frontmatter.ts
/**
 * Frontmatter Parsing Utilities
 * 
 * Robust YAML parser for extracting frontmatter from MDX/Markdown files.
 * Handles: scalars, arrays, nested objects, complex indentation.
 * No external dependencies.
 */

import fs from 'node:fs';

interface ParseResult {
  value: any;
  nextIndex: number;
}

/**
 * Parse frontmatter from a file
 * 
 * @param filePath - Path to MDX/Markdown file
 * @returns Parsed frontmatter data
 */
export function parseFrontmatter(filePath: string): Record<string, any> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseFrontmatterFromString(content);
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return {};
  }
}

/**
 * Parse frontmatter from a string
 * 
 * @param content - File content as string
 * @returns Parsed frontmatter data
 */
export function parseFrontmatterFromString(content: string): Record<string, any> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const yaml = match[1];
  const lines = yaml.split('\n');
  
  return parseYamlObject(lines, 0, 0).value;
}

/**
 * Parse YAML object/map
 */
function parseYamlObject(lines: string[], startIndex: number, baseIndent: number): ParseResult {
  const obj: Record<string, any> = {};
  let i = startIndex;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    
    const indent = line.length - line.trimStart().length;
    
    // If dedented, we're done with this object
    if (indent < baseIndent) {
      break;
    }
    
    // Parse key: value line
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      i++;
      continue;
    }
    
    const key = line.substring(0, colonIndex).trim();
    const valueStart = line.substring(colonIndex + 1).trim();
    
    // Inline value (key: value on same line)
    if (valueStart) {
      obj[key] = parseYamlValue(valueStart);
      i++;
      continue;
    }
    
    // Value on next line(s)
    i++;
    if (i >= lines.length) {
      obj[key] = null;
      break;
    }
    
    const nextLine = lines[i];
    const nextTrimmed = nextLine.trim();
    const nextIndent = nextLine.length - nextLine.trimStart().length;
    
    // Array value
    if (nextTrimmed.startsWith('-')) {
      const result = parseYamlArray(lines, i, nextIndent);
      obj[key] = result.value;
      i = result.nextIndex;
      continue;
    }
    
    // Nested object
    if (nextIndent > indent) {
      const result = parseYamlObject(lines, i, nextIndent);
      obj[key] = result.value;
      i = result.nextIndex;
      continue;
    }
    
    // No value found
    obj[key] = null;
  }
  
  return { value: obj, nextIndex: i };
}

/**
 * Parse YAML array/list
 */
/**
 * Parse YAML array/list
 */
function parseYamlArray(lines: string[], startIndex: number, baseIndent: number): ParseResult {
  const array: any[] = [];
  let i = startIndex;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    
    const indent = line.length - line.trimStart().length;
    
    // If dedented, we're done with this array
    if (indent < baseIndent) {
      break;
    }
    
    // Not an array item at this level
    if (!trimmed.startsWith('-')) {
      break;
    }
    
    const afterDash = trimmed.substring(1).trim();
    
    // ✅ FIX: Handle multiline objects in arrays
    if (afterDash && afterDash.includes(':')) {
      // This is the start of an object in the array
      const obj: Record<string, any> = {};
      
      // Parse the first property on the dash line
      const colonIndex = afterDash.indexOf(':');
      const key = afterDash.substring(0, colonIndex).trim();
      const value = afterDash.substring(colonIndex + 1).trim();
      obj[key] = parseYamlValue(value);
      
      // Move to next line
      i++;
      
      // ✅ Keep reading properties until we hit another dash at same level
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        // Stop if we hit empty line or comment
        if (!nextTrimmed || nextTrimmed.startsWith('#')) {
          i++;
          continue;
        }
        
        // Stop if we're back at or before the array indent
        if (nextIndent <= baseIndent) {
          break;
        }
        
        // Stop if we hit another array item
        if (nextTrimmed.startsWith('-')) {
          break;
        }
        
        // This should be another property of the current object
        if (nextTrimmed.includes(':')) {
          const propColonIndex = nextTrimmed.indexOf(':');
          const propKey = nextTrimmed.substring(0, propColonIndex).trim();
          const propValue = nextTrimmed.substring(propColonIndex + 1).trim();
          obj[propKey] = parseYamlValue(propValue);
          i++;
        } else {
          // Not a valid property, stop
          break;
        }
      }
      
      array.push(obj);
      continue;
    }
    
    // Simple inline value: - value
    if (afterDash) {
      array.push(parseYamlValue(afterDash));
      i++;
      continue;
    }
    
    // Multiline value: check next line
    i++;
    if (i >= lines.length) {
      array.push(null);
      break;
    }
    
    const nextLine = lines[i];
    const nextTrimmed = nextLine.trim();
    const nextIndent = nextLine.length - nextLine.trimStart().length;
    
    // Nested object in array
    if (nextIndent > indent && nextTrimmed && !nextTrimmed.startsWith('-')) {
      const result = parseYamlObject(lines, i, nextIndent);
      array.push(result.value);
      i = result.nextIndex;
      continue;
    }
    
    // Nested array in array
    if (nextIndent > indent && nextTrimmed.startsWith('-')) {
      const result = parseYamlArray(lines, i, nextIndent);
      array.push(result.value);
      i = result.nextIndex;
      continue;
    }
    
    // Empty array item
    array.push(null);
  }
  
  return { value: array, nextIndex: i };
}

/**
 * Parse scalar YAML value (string, number, boolean, etc)
 */
function parseYamlValue(value: string): any {
  const trimmed = value.trim();
  
  // Null values
  if (trimmed === 'null' || trimmed === '~' || trimmed === '') {
    return null;
  }
  
  // Boolean
  if (trimmed === 'true' || trimmed === 'yes' || trimmed === 'on') {
    return true;
  }
  if (trimmed === 'false' || trimmed === 'no' || trimmed === 'off') {
    return false;
  }
  
  // Number
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  
  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  // Flow array: [item1, item2]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const content = trimmed.slice(1, -1);
    if (!content.trim()) return [];
    return content.split(',').map(item => parseYamlValue(item));
  }
  
  // Flow object: {key: value}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const content = trimmed.slice(1, -1);
    const obj: Record<string, any> = {};
    const pairs = content.split(',');
    for (const pair of pairs) {
      const [key, val] = pair.split(':').map(s => s.trim());
      if (key) obj[key] = parseYamlValue(val || '');
    }
    return obj;
  }
  
  // Plain string
  return trimmed;
}

/**
 * Extract specific fields from frontmatter
 * 
 * @param filePath - Path to file
 * @param fields - Array of field names to extract
 * @returns Object with only requested fields
 */
export function extractFrontmatterFields(
  filePath: string,
  fields: string[]
): Record<string, any> {
  const data = parseFrontmatter(filePath);
  const result: Record<string, any> = {};
  
  for (const field of fields) {
    if (data[field] !== undefined) {
      result[field] = data[field];
    }
  }
  
  return result;
}

/**
 * Check if a file has frontmatter
 * 
 * @param filePath - Path to file
 * @returns True if file contains frontmatter
 */
export function hasFrontmatter(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return /^---\s*\n[\s\S]*?\n---/.test(content);
  } catch {
    return false;
  }
}