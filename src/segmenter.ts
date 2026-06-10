export interface TextSegment {
  index: number;
  source: string;
}

export function segmentText(text: string, maxCharacters: number): TextSegment[] {
  const limit = Math.max(100, maxCharacters);
  const blocks = splitMarkdownBlocks(text);
  const segments = blocks.flatMap((block) => splitLongText(block, limit));
  return segments.map((source, index) => ({ index, source }));
}

function splitMarkdownBlocks(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (isBlank(lines[index])) {
      index += 1;
      continue;
    }

    if (index === 0 && lines[index].trim() === "---") {
      const end = findClosingLine(lines, index + 1, "---");
      if (end !== -1) {
        blocks.push(lines.slice(index, end + 1).join("\n"));
        index = end + 1;
        continue;
      }
    }

    if (isFence(lines[index])) {
      const marker = lines[index].trim().slice(0, 3);
      const end = findClosingFence(lines, index + 1, marker);
      blocks.push(lines.slice(index, end + 1).join("\n"));
      index = end + 1;
      continue;
    }

    if (isHeading(lines[index]) || isHorizontalRule(lines[index])) {
      blocks.push(lines[index]);
      index += 1;
      continue;
    }

    if (isListItem(lines[index])) {
      const end = findListEnd(lines, index);
      blocks.push(lines.slice(index, end).join("\n"));
      index = end;
      continue;
    }

    if (isQuote(lines[index])) {
      const end = findWhile(lines, index, (line) => isQuote(line));
      blocks.push(lines.slice(index, end).join("\n"));
      index = end;
      continue;
    }

    const end = findWhile(
      lines,
      index,
      (line) =>
        !isBlank(line) &&
        !isHeading(line) &&
        !isHorizontalRule(line) &&
        !isFence(line) &&
        !isListItem(line) &&
        !isQuote(line),
    );
    blocks.push(lines.slice(index, end).join("\n"));
    index = end;
  }

  return blocks.filter((block) => block.length > 0);
}

function splitLongText(text: string, limit: number): string[] {
  const pieces: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit + 1);
    const breakAt = findBreakPosition(window, limit);
    pieces.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }

  if (remaining) {
    pieces.push(remaining);
  }
  return pieces.filter(Boolean);
}

function findBreakPosition(text: string, fallback: number): number {
  const candidates = [
    text.lastIndexOf("\n", fallback),
    text.lastIndexOf(". ", fallback),
    text.lastIndexOf("。", fallback),
    text.lastIndexOf("! ", fallback),
    text.lastIndexOf("！", fallback),
    text.lastIndexOf("? ", fallback),
    text.lastIndexOf("？", fallback),
    text.lastIndexOf(" ", fallback),
  ];
  const best = Math.max(...candidates);
  return best >= Math.floor(fallback * 0.5) ? best + 1 : fallback;
}

function findClosingLine(
  lines: string[],
  start: number,
  marker: string,
): number {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].trim() === marker) {
      return index;
    }
  }
  return -1;
}

function findClosingFence(
  lines: string[],
  start: number,
  marker: string,
): number {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith(marker)) {
      return index;
    }
  }
  return lines.length - 1;
}

function findListEnd(lines: string[], start: number): number {
  let index = start + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      break;
    }
    if (!isListItem(line) && !/^\s+/.test(line)) {
      break;
    }
    index += 1;
  }
  return index;
}

function findWhile(
  lines: string[],
  start: number,
  predicate: (line: string) => boolean,
): number {
  let index = start;
  while (index < lines.length && predicate(lines[index])) {
    index += 1;
  }
  return index;
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isHeading(line: string): boolean {
  return /^\s{0,3}#{1,6}\s+/.test(line);
}

function isHorizontalRule(line: string): boolean {
  return /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line);
}

function isFence(line: string): boolean {
  return /^\s{0,3}(```|~~~)/.test(line);
}

function isListItem(line: string): boolean {
  return /^\s{0,3}([-+*]|\d+[.)])\s+/.test(line);
}

function isQuote(line: string): boolean {
  return /^\s{0,3}>\s?/.test(line);
}
