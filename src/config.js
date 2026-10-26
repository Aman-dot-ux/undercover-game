import os from 'os';

/**
 * Automatically determine the best LAN IPv4 address, prioritizing Wi-Fi.
 */
export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      // IPv4 only, exclude loopback 127.0.0.1 and link-local auto-configured (169.254.x.x)
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        const lowerName = name.toLowerCase();
        let priority = 1;
        // Prioritize Wi-Fi and Wireless interfaces
        if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan')) {
          priority = 10;
        } else if (lowerName.includes('ethernet') || lowerName.includes('eth')) {
          priority = 5;
        } else if (lowerName.includes('vgate') || lowerName.includes('vethernet') || lowerName.includes('virtual') || lowerName.includes('wsl')) {
          priority = 0; // Deprioritize virtual adapters
        }

        candidates.push({
          address: net.address,
          name,
          priority
        });
      }
    }
  }

  // Sort descending by priority
  candidates.sort((a, b) => b.priority - a.priority);

  if (candidates.length > 0) {
    return {
      ip: candidates[0].address,
      interfaceName: candidates[0].name,
      allCandidates: candidates
    };
  }

  return {
    ip: '127.0.0.1',
    interfaceName: 'Loopback',
    allCandidates: []
  };
}

export const PORT = parseInt(process.env.PORT, 10) || 3000;
export const HOST = '0.0.0.0';
