import { visit } from 'unist-util-visit';
import type { Root, Link, Text, Parent, PhrasingContent } from 'mdast';

/**
 * @file remark-trim-autolink-host.ts
 * @input An mdast tree, after GFM's autolink-literal transform has turned bare
 *   `www.` / `http(s)://` runs into `link` nodes.
 * @output The same tree, with punctuation that cannot appear in a hostname
 *   trimmed off the end of an autolink's authority and pushed back into the
 *   surrounding prose as plain text.
 * @position Chat (components/markdown.tsx) and canvas (lib/utils.ts).
 *
 * GFM stops a bare autolink at whitespace and then trims a short trailing set
 * (`?!.,:*_~` and balanced parens). An em dash is in neither group, so
 * `Our site—www.google.com—has more.` links the text `www.google.com—has` to
 * `http://www.google.com—has`, whose authority the URL parser reads as the
 * host `www.google.xn--comhas-5g0c`. The reader sees google.com and follows a
 * link that never resolves there. Assistants punctuate with em dashes
 * constantly, so this fires on ordinary prose.
 *
 * Scope. Only the authority is inspected -- a path may legitimately hold any
 * of these characters, so `example.com/a—b` is left alone. Only autolinks are
 * considered: an explicit `[text](url)` is authored, and its label is not the
 * URL, so it never matches. A trim that would empty the host is skipped rather
 * than producing a link to nothing.
 */

// Letters and digits (any script, so IDN hosts survive) plus the three
// punctuation marks an authority may legitimately contain: `-` and `.` inside
// the host, `:` before a port.
const HOST_CHAR = /[\p{L}\p{N}\-.:]/u;

const AUTOLINK_PREFIX = /^(https?:\/\/|mailto:)/;

/** The authority is what precedes the first `/`, `?` or `#`. */
function authorityLength(rest: string): number {
  const cut = rest.search(/[/?#]/);
  return cut === -1 ? rest.length : cut;
}

/**
 * A GFM autolink literal renders its own source as its label, so the single
 * text child equals the URL minus any protocol the transform prepended. An
 * authored link fails this and is skipped.
 */
function autolinkLabel(node: Link): string | null {
  if (node.children.length !== 1) return null;
  const [child] = node.children;
  if (child.type !== 'text') return null;
  // `www.x.com` is labelled without the `http://` the transform prepends;
  // `https://x.com` is labelled with its own scheme intact.
  const stripped = node.url.replace(AUTOLINK_PREFIX, '');
  if (child.value === node.url || child.value === stripped) return child.value;
  return null;
}

export function remarkTrimAutolinkHost() {
  return (tree: Root): void => {
    visit(tree, 'link', (node: Link, index, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;

      // An email autolink has no authority to police, and its local part may
      // hold `@` and other characters a host may not.
      if (node.url.startsWith('mailto:')) return;

      const label = autolinkLabel(node);
      if (label === null) return;

      // A `https://` label carries its own scheme, whose `//` would otherwise
      // read as the start of the path and leave the host uninspected.
      const scheme = AUTOLINK_PREFIX.exec(label)?.[0].length ?? 0;
      const afterScheme = label.slice(scheme);
      const authority = afterScheme.slice(0, authorityLength(afterScheme));

      let cut = -1;
      for (let i = 0; i < authority.length; i++) {
        if (!HOST_CHAR.test(authority[i])) {
          cut = scheme + i;
          break;
        }
      }
      if (cut === -1) return;

      const kept = label.slice(0, cut);
      // Nothing resolvable left (a bare `www.`, or punctuation only).
      if (!/[\p{L}\p{N}]/u.test(kept)) return;

      const trailing = label.slice(cut);
      const prefix = node.url.slice(0, node.url.length - label.length);

      node.url = prefix + kept;
      node.children = [{ type: 'text', value: kept } as Text];

      const rest: PhrasingContent = { type: 'text', value: trailing };
      parent.children.splice(index + 1, 0, rest);
      return index + 2;
    });
  };
}
