---
id: S32
title: Render markdown in chat messages
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S32 — Render markdown in chat messages

## User story

As a **runner chatting with CoachLM**,
I want **assistant messages rendered as proper markdown**
so that **headings, tables, links, blockquotes, and formatted text display correctly instead of raw markdown syntax**.

## Problem

The current hand-rolled `renderMarkdown()` function in `Chat.tsx` handles only basic markdown (bold, italic, code blocks, inline code, unordered lists). LLM responses frequently include headings, tables, links, blockquotes, numbered lists, horizontal rules, and nested formatting that are not rendered, making responses harder to read.

## Acceptance criteria

- [ ] Assistant chat messages render full CommonMark-compliant markdown including: headings, bold, italic, strikethrough, code blocks, inline code, ordered and unordered lists, nested lists, links, images, blockquotes, horizontal rules, and tables
- [ ] The hand-rolled `renderMarkdown()` function is replaced with the `react-markdown` library
- [ ] Rendered HTML is sanitized — no raw script execution from LLM output
- [ ] All new markdown elements have proper CSS styling that matches the dark theme
- [ ] User messages remain plain text (no markdown rendering)
- [ ] Links open in external browser (not inside the Tauri webview)
- [ ] Existing rendering (code blocks, bold, italic, lists) continues to work at least as well as before

## Technical notes

- Install `react-markdown` and `remark-gfm` as runtime dependencies in `package.json`
- Replace `renderMarkdown()` in `Chat.tsx` with the `<ReactMarkdown>` component
- Configure `react-markdown` with `remarkGfm` for GitHub-flavored markdown (tables, strikethrough)
- Add CSS for: `h1`-`h4`, `a`, `blockquote`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `hr`, `del`, `ol`, `img`, nested `ul`/`ol`
- Links: add `target="_blank"` and `rel="noopener noreferrer"` via custom components in `react-markdown`

## Tests required

- Unit: not applicable (frontend-only, visual change)
- Manual: send a message that triggers markdown headings, tables, code blocks, lists, links, blockquotes in the response and verify rendering
- Edge case: message with no markdown renders as plain text paragraph
- Edge case: malicious HTML in LLM response is escaped, not executed

## Out of scope

- Syntax highlighting for code blocks (separate story)
- LaTeX / math rendering
- Mermaid diagrams
- Copy-to-clipboard for code blocks

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | in-progress | Created and implementing |
| 2026-03-18 | done | Replaced hand-rolled renderer with react-markdown, added full CSS for all markdown elements |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
