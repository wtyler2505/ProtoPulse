import os
import glob
import re
from collections import defaultdict

KNOWLEDGE_DIR = "knowledge"

if not os.path.exists(KNOWLEDGE_DIR):
    print(f"Error: {KNOWLEDGE_DIR} not found.")
    exit(1)

# Extract descriptions
descriptions = {}
for filepath in glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md")):
    name = os.path.basename(filepath)[:-3]
    desc = ""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        # try to find description in YAML frontmatter or first paragraph
        match = re.search(r'^description:\s*(.+)$', content, re.MULTILINE)
        if match:
            desc = match.group(1).strip()
    descriptions[name] = desc

# Build adjacency lists
outgoing = defaultdict(set)
incoming = defaultdict(set)
undirected = defaultdict(set)
nodes = set()

link_pattern = re.compile(r'\[\[([^\]]+)\]\]')

for filepath in glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md")):
    name = os.path.basename(filepath)[:-3]
    nodes.add(name)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        links = link_pattern.findall(content)
        for link in links:
            # handle aliases [[link|alias]]
            target = link.split('|')[0].strip()
            outgoing[name].add(target)
            incoming[target].add(name)
            undirected[name].add(target)
            undirected[target].add(name)
            nodes.add(target) # implicitly add target even if file doesn't exist

# 1. Hubs
print("--=={ graph hubs }==--\n")
authorities = sorted([(len(incoming[n]), n) for n in nodes if n in incoming], reverse=True)
hubs = sorted([(len(outgoing[n]), n) for n in nodes if n in outgoing], reverse=True)

print("  Top Authorities (most-linked-to):")
for count, node in authorities[:5]:
    desc = descriptions.get(node, "")
    print(f"    - [[{node}]] — {count} incoming links — \"{desc}\"")

print("\n  Top Hubs (most-linking-from):")
for count, node in hubs[:5]:
    desc = descriptions.get(node, "")
    print(f"    - [[{node}]] — {count} outgoing links — \"{desc}\"")

print("\n  Synthesizers (high on both):")
# Compute score = in_degree * out_degree
synthesizers = sorted([(len(incoming[n]) * len(outgoing[n]), len(incoming[n]), len(outgoing[n]), n) for n in nodes], reverse=True)
for score, inc, out, node in synthesizers[:5]:
    if score > 0:
        desc = descriptions.get(node, "")
        print(f"    - [[{node}]] — {inc} in / {out} out — \"{desc}\"")

# 2. Triangles (Synthesis opportunities)
print("\n--=={ graph triangles }==--\n")
open_triangles = []
for a in nodes:
    targets = list(outgoing[a])
    for i in range(len(targets)):
        for j in range(i+1, len(targets)):
            b = targets[i]
            c = targets[j]
            # Check if B and C are connected
            if c not in outgoing[b] and b not in outgoing[c] and c not in incoming[b] and b not in incoming[c]:
                open_triangles.append((a, b, c))

print(f"  Found {len(open_triangles)} synthesis opportunities (open triangles). Top 5:")
for idx, (a, b, c) in enumerate(open_triangles[:5]):
    print(f"\n  {idx+1}. [[{b}]] and [[{c}]]")
    print(f"     Common parent: [[{a}]]")
    print(f"     B: \"{descriptions.get(b, '')}\"")
    print(f"     C: \"{descriptions.get(c, '')}\"")

# 3. Bridges
print("\n--=={ graph bridges }==--\n")
def count_components(exclude_node=None):
    visited = set()
    components = 0
    active_nodes = [n for n in nodes if n != exclude_node]
    for node in active_nodes:
        if node not in visited:
            components += 1
            queue = [node]
            visited.add(node)
            while queue:
                curr = queue.pop(0)
                for neighbor in undirected[curr]:
                    if neighbor != exclude_node and neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
    return components

base_components = count_components()
bridges = []

for node in nodes:
    comps = count_components(exclude_node=node)
    if comps > base_components:
        bridges.append((node, comps - base_components))

bridges.sort(key=lambda x: x[1], reverse=True)
print(f"  Found {len(bridges)} bridge notes:")
for idx, (node, extra_comps) in enumerate(bridges[:5]):
    desc = descriptions.get(node, "")
    print(f"\n  {idx+1}. [[{node}]] — connects previously joined components")
    print(f"     Description: \"{desc}\"")

