export function formatUpdateStatusMessage(status) {
  const rawMessage = String(status?.message || 'Update status changed.');
  const statusCode = String(status?.status || '').toLowerCase();

  if (statusCode === 'error') {
    const lower = rawMessage.toLowerCase();
    if (lower.includes('httperror') || lower.includes('404') || lower.includes('401') || lower.includes('authentication token')) {
      return 'Could not reach the public update file. Try again, or open the release page.';
    }
    return rawMessage.split('\n')[0].slice(0, 140);
  }

  return rawMessage.slice(0, 180);
}
