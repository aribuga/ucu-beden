export function formatAge(ageMonths: number): string {
  if (ageMonths <= 0) {
    return "0 ay";
  }

  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;

  if (years === 0) {
    return `${months} ay`;
  }

  if (months === 0) {
    return `${years} yıl`;
  }

  return `${years} yıl ${months} ay`;
}

export function nextAgeMonths(currentAgeMonths: number): number {
  return currentAgeMonths + 1;
}
