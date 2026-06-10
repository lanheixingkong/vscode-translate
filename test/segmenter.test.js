const assert = require("node:assert/strict");
const { segmentText } = require("../dist/segmenter.js");

const markdown = `---
name: script-writing
description: Story writing workflow.
---

# Script Writing

Introduction paragraph.

## Core Rule

Build the story in layers:

1. Audience dream
2. Genre and hook
3. Core conflict

Then choose the right path:`;

const segments = segmentText(markdown, 2000).map((segment) => segment.source);

assert.deepEqual(segments, [
  "---\nname: script-writing\ndescription: Story writing workflow.\n---",
  "# Script Writing",
  "Introduction paragraph.",
  "## Core Rule",
  "Build the story in layers:",
  "1. Audience dream\n2. Genre and hook\n3. Core conflict",
  "Then choose the right path:",
]);

const longSegments = segmentText("x".repeat(4500), 2000);
assert.equal(longSegments.length, 3);
assert.ok(longSegments.every((segment) => segment.source.length <= 2000));

console.log("segmenter tests passed");
