import fs from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-notifications') {
    return {
      url: new URL('./mocks/expo-notifications.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native') {
    return {
      url: new URL('./mocks/react-native.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === '@react-native-async-storage/async-storage') {
    return {
      url: new URL('./mocks/async-storage.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'expo-linking') {
    return {
      url: new URL('./mocks/expo-linking.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }

  // Handle extensionless relative imports (e.g. ./events -> ./events.ts)
  if (specifier.startsWith('.') && context.parentURL) {
    for (const ext of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']) {
      try {
        const candidate = new URL(specifier + ext, context.parentURL);
        if (fs.existsSync(candidate)) {
          return nextResolve(candidate.href, context);
        }
      } catch {}
    }
  }

  return nextResolve(specifier, context);
}
