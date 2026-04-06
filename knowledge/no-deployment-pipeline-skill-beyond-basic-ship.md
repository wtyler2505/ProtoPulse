---
description: The /ship skill only covers git commit and push -- no CI/CD, deployment verification, release tagging, or production health check workflow exists
type: need
source: ".claude/skills/ship/, skill listings"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/skills/ship/"]
---

# no deployment pipeline skill beyond basic ship

The /ship skill (106 lines) runs type check, tests, and git commit+push. It stops at "code is in the remote repository." No skill covers what happens after push: CI/CD pipeline monitoring, deployment verification, release tagging, changelog generation, production health checks, or rollback procedures.

A deploy-checklist skill exists in the global skills directory ("safe deployment procedures with pre-deploy verification and rollback planning"), but it's a generic skill not tailored to ProtoPulse's specific deployment needs. It also doesn't integrate with /ship -- the two are independent.

As ProtoPulse moves toward a native desktop application via Tauri, deployment becomes more complex: building platform-specific binaries, code signing, auto-update channel management, and platform-specific testing. The gap between /ship (git push) and a real deployment pipeline will widen.

The finishing-a-development-branch skill covers the merge/PR/cleanup decision after implementation, but it too stops at the repository boundary.

---

Relevant Notes:
- [[no-database-migration-skill-despite-drizzle-being-core]] -- another missing infrastructure workflow
- [[ship-and-verify-overlap-on-commit-validation-territory]] -- ship's limited scope

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
