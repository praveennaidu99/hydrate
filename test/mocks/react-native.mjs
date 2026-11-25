export const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};

export const NativeModules = {
  HydrationWidgetModule: {
    updateWidget: () => {},
    getPendingWidgetAdds: async () => 0,
  },
};
