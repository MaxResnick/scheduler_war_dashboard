const HARMONIC_CLIENT_PATTERN =
  /^(Harmonic(?:Agave|Frankendancer|Firedancer))(FBA|MREV|FIFO)$/;

export function formatSoftwareClientLabel(softwareClient: string): string {
  const match = softwareClient.match(HARMONIC_CLIENT_PATTERN);
  if (!match) return softwareClient;

  return `${match[1]} (${match[2]})`;
}

export function getHarmonicClientFamily(
  softwareClient: string,
): string | null {
  if (softwareClient === "Harmonic") return softwareClient;

  const match = softwareClient.match(HARMONIC_CLIENT_PATTERN);
  if (match) return match[1];

  if (
    softwareClient === "HarmonicAgave" ||
    softwareClient === "HarmonicFrankendancer" ||
    softwareClient === "HarmonicFiredancer"
  ) {
    return softwareClient;
  }

  return null;
}
