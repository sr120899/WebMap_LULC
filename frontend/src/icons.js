function svg(inner, { size = 20 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export const icons = {
  logo: () =>
    svg(
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 5.6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.6-4-9s1.5-6.5 4-9z"/>',
      { size: 26 }
    ),
  box: () =>
    svg(
      '<path d="M21 8V7l-3-4H6L3 7v1"/><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z"/><path d="M3 8l3.5 4M21 8l-3.5 4"/><path d="M9.5 12h5"/>'
    ),
  trendUp: () => svg('<path d="M4 17 10 11l4 4 6-7"/><path d="M15 7h5v5"/>'),
  ban: () => svg('<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>'),
  layers: () =>
    svg('<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M2 13l10 5 10-5"/><path d="M2 17.5l10 5 10-5"/>'),
  expand: () =>
    svg(
      '<path d="M8 3H4a1 1 0 0 0-1 1v4"/><path d="M16 3h4a1 1 0 0 1 1 1v4"/><path d="M8 21H4a1 1 0 0 1-1-1v-4"/><path d="M16 21h4a1 1 0 0 0 1-1v-4"/>'
    ),
  droplet: () => svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  leaf: () =>
    svg(
      '<path d="M20 4S9 3 5 9s-1 12 4 12 10-4 11-13a12 12 0 0 0 0-4z"/><path d="M9 15c3-3 6-6 10-9"/>'
    ),
  building: () =>
    svg(
      '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/><path d="M10 21v-4h4v4"/>'
    ),
  snowflake: () =>
    svg(
      '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M8 4l4 3 4-3M8 20l4-3 4 3M2.5 9l3.5 3-3.5 3M21.5 9l-3.5 3 3.5 3"/>'
    ),
  circleDot: () => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'),
};
