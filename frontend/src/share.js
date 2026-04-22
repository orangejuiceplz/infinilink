export function generateShareText(mode, gameNumber, chain, avgSimilarity, timeStr, totalWords) {
  const modeLabel = mode === 'daily' ? `Daily #${gameNumber}` : mode === 'timed' ? 'Timed' : 'Infinite';
  const chainStr = chain.join(' → ');
  const links = chain.length - 1;

  let text = `infinilink ${modeLabel} 🔗\n`;
  text += `${chainStr}\n`;
  text += `${links} link${links !== 1 ? 's' : ''} · avg ${avgSimilarity}%`;
  if (timeStr) text += ` · ⏱ ${timeStr}`;
  text += `\n`;

  return text;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
