# File Organization Best Practices

## 1. The "Inbox" Pattern
Never sort files directly in a busy folder like `Downloads/`. Instead, create a `Downloads/Sorted/` directory and move organized files there. This leaves the root clear for new, incoming files.

## 2. Temporal Organization vs. Semantic Organization
*   **Temporal (By Date):** Best for Receipts, Photos, and Log files.
*   **Semantic (By Project/Topic):** Best for Code, Research, and Writing.
*   *Rule of Thumb:* If the file is only relevant to a specific event (e.g., "Taxes 2023"), sort by Date. If it's a reusable asset (e.g., "Company Logo"), sort by Topic.

## 3. Dealing with Unknowns
If a file has no extension and `file --mime-type` returns `application/octet-stream`, DO NOT move it blindly. Move it to an `_Uncategorized/` folder for manual review. It might be a proprietary cache or index file.

## 4. Normalization Rules
*   Prefer `kebab-case` over `CamelCase` or `snake_case` for broad compatibility across web and CLI tools.
*   Never use spaces in directory names intended for automated parsing.

## 5. Pruning Strategy
When organizing, actively identify files modified more than 2 years ago and suggest moving them to a compressed `.tar.gz` archive to save inode space and reduce visual clutter.