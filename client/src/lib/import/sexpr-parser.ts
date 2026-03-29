/**
 * S-Expression Parser
 *
 * Tokenizer and parser for S-expression formats used by KiCad and OrCAD.
 *
 * @module sexpr-parser
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SExprNode {
  tag: string;
  values: string[];
  children: SExprNode[];
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize an S-expression string.
 * Handles quoted strings and parentheses.
 */
export function tokenizeSExpr(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < len) {
          str += input[i] + input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      str += '"';
      i++; // skip closing quote
      tokens.push(str);
      continue;
    }

    // Atom
    let atom = '';
    while (i < len && input[i] !== ' ' && input[i] !== '\t' && input[i] !== '\n' && input[i] !== '\r' && input[i] !== '(' && input[i] !== ')') {
      atom += input[i];
      i++;
    }
    if (atom.length > 0) {
      tokens.push(atom);
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse tokenized S-expressions into a tree structure.
 */
export function parseSExprTokens(tokens: string[]): SExprNode[] {
  const nodes: SExprNode[] = [];
  let i = 0;

  function parseNode(): SExprNode | null {
    if (i >= tokens.length || tokens[i] !== '(') {
      return null;
    }
    i++; // skip '('

    if (i >= tokens.length) {
      return null;
    }

    const tag = unquote(tokens[i]);
    i++;

    const values: string[] = [];
    const children: SExprNode[] = [];

    while (i < tokens.length && tokens[i] !== ')') {
      if (tokens[i] === '(') {
        const child = parseNode();
        if (child) {
          children.push(child);
        }
      } else {
        values.push(unquote(tokens[i]));
        i++;
      }
    }

    if (i < tokens.length) {
      i++; // skip ')'
    }

    return { tag, values, children };
  }

  while (i < tokens.length) {
    if (tokens[i] === '(') {
      const node = parseNode();
      if (node) {
        nodes.push(node);
      }
    } else {
      i++;
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

export function findChild(node: SExprNode, tag: string): SExprNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

export function findChildren(node: SExprNode, tag: string): SExprNode[] {
  return node.children.filter((c) => c.tag === tag);
}

export function getChildValue(node: SExprNode, tag: string): string | undefined {
  const child = findChild(node, tag);
  return child?.values[0];
}
