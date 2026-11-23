# Graph Report - hadir-almoalem  (2026-11-23)

## Corpus Check
- 10 files · ~13,842 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .bat 2, .zip 1, .webmanifest 1)

## Summary
- 103 nodes · 167 edges · 11 communities (8 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `406b68d4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- background.js
- teams.js
- manifest.json
- popup.js
- worker.js
- action
- share-video
- outlook.js
- حاضر المعلم

## God Nodes (most connected - your core abstractions)
1. `lock()` - 10 edges
2. `click()` - 9 edges
3. `meetingOptionsLock()` - 8 edges
4. `get()` - 7 edges
5. `tick()` - 7 edges
6. `render()` - 7 edges
7. `press()` - 6 edges
8. `join()` - 6 edges
9. `mutate()` - 5 edges
10. `ymd()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 3 thin omitted)

### Community 0 - "background.js"
Cohesion: 0.20
Nodes (17): autoShare(), cdp(), checkUpdate(), DEF, get(), merge(), mins(), mutate() (+9 more)

### Community 1 - "teams.js"
Cohesion: 0.25
Nodes (19): badge(), click(), closeLeaveMenu(), confirmDialog(), endMeeting(), findBtn(), findToggle(), init() (+11 more)

### Community 2 - "manifest.json"
Cohesion: 0.13
Nodes (14): background, service_worker, content_scripts, description, host_permissions, icons, 128, 16 (+6 more)

### Community 3 - "popup.js"
Cohesion: 0.33
Nodes (8): DEF, esc(), fmt(), get(), pad(), render(), RUN, ymd()

### Community 4 - "worker.js"
Cohesion: 0.31
Nodes (7): Ctl, fetch(), json(), MAP, page(), raw(), TYPES

### Community 5 - "action"
Cohesion: 0.29
Nodes (7): action, default_icon, default_popup, default_title, 128, 16, 48

### Community 6 - "share-video"
Cohesion: 0.29
Nodes (7): commands, share-video, description, global, suggested_key, default, mac

### Community 7 - "outlook.js"
Cohesion: 0.52
Nodes (6): findBtn(), findLink(), findVideo(), parse(), run(), scrapeVisible()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `action` connect `action` to `manifest.json`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `commands` connect `share-video` to `manifest.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._