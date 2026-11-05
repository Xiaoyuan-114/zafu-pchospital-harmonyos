/** 将公开指南中的常见 Markdown 转成适合窄屏阅读的文本；不改变代码块内容。 */
function readableInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match: string, alt: string, target: string) => `图片：${alt || '未命名图片'}（原文资源：${target}；当前无法显示）`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: string, label: string, target: string) => `${label}（${target}）`)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell: string) => readableInline(cell.trim()));
}

function tableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell: string) => /^:?-{3,}:?$/.test(cell));
}

export function formatGuideContent(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let code = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { code = !code; out.push(line); continue; }
    if (code) { out.push(line); continue; }
    if (i + 1 < lines.length && line.trim().startsWith('|') && !line.includes('\\|') && tableSeparator(lines[i + 1])) {
      const headers = tableCells(line);
      let end = i + 2;
      while (end < lines.length && lines[end].trim().startsWith('|') && !lines[end].includes('\\|')) end++;
      const rows = lines.slice(i + 2, end).map(tableCells);
      if (rows.length > 0 && rows.every((row: string[]) => row.length === headers.length)) {
        for (const row of rows) {
          out.push(row.map((cell: string, index: number) => `${headers[index]}：${cell}`).join('\n'));
          out.push('');
        }
        i = end - 1;
        continue;
      }
    }
    const alert = line.match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
    if (alert) {
      const labels: Record<string, string> = { NOTE: '说明', TIP: '提示', IMPORTANT: '重要', WARNING: '警告', CAUTION: '注意' };
      out.push(labels[alert[1].toUpperCase()] + '：');
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { out.push(''); continue; }
    out.push(readableInline(line.replace(/^\s*>\s?/, '').replace(/^\s*#{1,6}\s+/, '')));
  }
  return out.join('\n').trim();
}
