/**
 * XML Parser
 *
 * Simple XML parser for EAGLE design files. Not a full XML parser,
 * but handles the subset used by EAGLE .sch, .brd, and .lbr files.
 *
 * @module xml-parser
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface XmlNode {
  tag: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Simple XML parser. Not a full XML parser, but handles EAGLE files.
 */
export function parseXml(input: string): XmlNode | null {
  // Remove XML declaration and DOCTYPE
  let cleaned = input.replace(/<\?xml[^?]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').trim();

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  return parseXmlNode(cleaned, 0).node;
}

function parseXmlNode(input: string, pos: number): { node: XmlNode | null; end: number } {
  // Skip whitespace
  while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
    pos++;
  }

  if (pos >= input.length || input[pos] !== '<') {
    return { node: null, end: pos };
  }

  // Check for self-closing or opening tag
  const tagStart = pos;
  pos++; // skip '<'

  // Read tag name
  let tagName = '';
  while (pos < input.length && input[pos] !== ' ' && input[pos] !== '>' && input[pos] !== '/' && input[pos] !== '\n' && input[pos] !== '\r' && input[pos] !== '\t') {
    tagName += input[pos];
    pos++;
  }

  // Read attributes
  const attributes: Record<string, string> = {};
  while (pos < input.length && input[pos] !== '>' && !(input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>')) {
    // Skip whitespace
    while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
      pos++;
    }

    if (input[pos] === '>' || (input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>')) {
      break;
    }

    // Read attribute name
    let attrName = '';
    while (pos < input.length && input[pos] !== '=' && input[pos] !== ' ' && input[pos] !== '>' && input[pos] !== '/') {
      attrName += input[pos];
      pos++;
    }

    if (input[pos] === '=') {
      pos++; // skip '='
      if (input[pos] === '"') {
        pos++; // skip opening quote
        let attrValue = '';
        while (pos < input.length && input[pos] !== '"') {
          attrValue += input[pos];
          pos++;
        }
        pos++; // skip closing quote
        attributes[attrName] = attrValue;
      }
    }
  }

  // Self-closing tag
  if (input[pos] === '/' && pos + 1 < input.length && input[pos + 1] === '>') {
    pos += 2;
    return {
      node: { tag: tagName, attributes, children: [], text: '' },
      end: pos,
    };
  }

  if (input[pos] === '>') {
    pos++; // skip '>'
  }

  // Read children and text content
  const children: XmlNode[] = [];
  let text = '';

  while (pos < input.length) {
    // Skip whitespace
    while (pos < input.length && (input[pos] === ' ' || input[pos] === '\n' || input[pos] === '\r' || input[pos] === '\t')) {
      pos++;
    }

    if (pos >= input.length) {
      break;
    }

    // Check for closing tag
    if (input[pos] === '<' && pos + 1 < input.length && input[pos + 1] === '/') {
      // Find end of closing tag
      const closeEnd = input.indexOf('>', pos);
      if (closeEnd !== -1) {
        pos = closeEnd + 1;
      }
      break;
    }

    // Check for child element
    if (input[pos] === '<') {
      const childResult = parseXmlNode(input, pos);
      if (childResult.node) {
        children.push(childResult.node);
        pos = childResult.end;
      } else {
        pos++;
      }
    } else {
      // Text content
      while (pos < input.length && input[pos] !== '<') {
        text += input[pos];
        pos++;
      }
    }
  }

  // Handle case where we started parsing but tagName is empty (shouldn't happen normally)
  if (tagName.length === 0) {
    return { node: null, end: tagStart + 1 };
  }

  return {
    node: { tag: tagName, attributes, children, text: text.trim() },
    end: pos,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function findXmlChildren(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter((c) => c.tag === tag);
}

export function findXmlChild(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

export function findXmlDescendant(node: XmlNode, tag: string): XmlNode | undefined {
  if (node.tag === tag) {
    return node;
  }
  for (const child of node.children) {
    const found = findXmlDescendant(child, tag);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function findXmlDescendants(node: XmlNode, tag: string): XmlNode[] {
  const results: XmlNode[] = [];
  if (node.tag === tag) {
    results.push(node);
  }
  node.children.forEach((child) => {
    results.push(...findXmlDescendants(child, tag));
  });
  return results;
}
