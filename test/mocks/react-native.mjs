export const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};
