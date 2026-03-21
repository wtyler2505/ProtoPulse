function parseSizeToBytes(size) {
  const trimmed = size.trim().toUpperCase();
  if (trimmed.endsWith('K')) return parseInt(trimmed.slice(0, -1), 10) * 1024;
  if (trimmed.endsWith('M')) return parseInt(trimmed.slice(0, -1), 10) * 1024 * 1024;
  if (trimmed.startsWith('0X')) return parseInt(trimmed, 16);
  return parseInt(trimmed, 10);
}
console.log('4MB:', parseSizeToBytes('4MB'));
console.log('4M:', parseSizeToBytes('4M'));
console.log('NaN check:', isNaN(parseSizeToBytes('4MB')));
