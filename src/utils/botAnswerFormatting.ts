export function formatBotAnswer(text: string) {
  const answer = text.replace(/\r\n/g, '\n').trim();
  // Split explicit list markers and parenthesized entries without splitting amounts or addresses at every comma.
  const numbered = /[ \t]+(?=\d{1,3}[.)][ \t]+\S)/g;
  const bullets = /[ \t]+(?=[•▪][ \t]+)/g;
  const entries = /\)(?:,[ \t]+|[ \t]+y[ \t]+)(?=[^\n()]{1,100}\([^)\n]{2,60}\))/g;
  const hasInlineList = (answer.match(numbered)?.length ?? 0) > 1 || /^\d{1,3}[.)]\s/.test(answer);
  const separated = (hasInlineList ? answer.replace(numbered, '\n') : answer)
    .replace(bullets, '\n').replace(entries, ')\n');
  return separated.split('\n').map((line) => {
    if (line.length < 260) return line;
    return line.replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/g, '$1\n\n');
  }).join('\n');
}
