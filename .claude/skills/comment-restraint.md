---
description: Cut comments down to what code cannot say. Invoke before finishing any change that adds or edits comments, and when reviewing a diff for comment noise.
---

# Comment Restraint Skill

Most code needs no comments. A comment is read every time the code is read and
rots the moment the code moves, so it has to earn that cost.

## The test

Delete the comment. If a competent reader learns nothing from the code alone
that the comment was telling them, the comment was noise. Keep it only when it
carries one of these:

- **A why** — a rationale, trade-off or business rule the code cannot show.
- **A gotcha** — why something is done an unusual way, ideally with a ticket.
- **A warning** — a non-obvious consequence or ordering requirement.

## Never write

- Narration of the next line: `// resolve the agent`, `// loop over results`.
- Restatements of a signature, type or name: a doc block on `readPurposeAgent`
  that says it reads a purpose agent.
- JSDoc on an obvious parameter or return.
- Section banners, decoration, or a comment introducing an import.
- Scaffolding notes: `// added by`, `// this now does X`, resolved TODOs.
- A paragraph where a better name would do. Rename instead.

## Density

One short comment per non-obvious decision, not per block. A function with
three comments is usually a function whose names are wrong. If a file reads
like prose with code between it, cut.

A doc block on an exported symbol is worth it only when callers need something
the signature cannot give them — what null means, what the caller must do next,
an ordering requirement. Otherwise the name is the documentation.

## Before finishing

Re-read the diff for comments alone. For each, ask what it says that the code
does not. Delete the ones that answer "nothing". This applies to code being
edited as much as to code being written — do not leave existing noise behind.
