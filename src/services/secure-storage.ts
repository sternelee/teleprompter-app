import * as SecureStore from "expo-secure-store";

const API_KEY_KEY = "deepseek_api_key";

export async function loadApiKey(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(API_KEY_KEY)) ?? "";
  } catch (error) {
    console.warn("Failed to load API key from secure storage:", error);
    return "";
  }
}

export async function saveApiKey(key: string): Promise<void> {
  try {
    if (key) {
      await SecureStore.setItemAsync(API_KEY_KEY, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } else {
      await SecureStore.deleteItemAsync(API_KEY_KEY);
    }
  } catch (error) {
    console.warn("Failed to save API key to secure storage:", error);
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_KEY);
  } catch (error) {
    console.warn("Failed to clear API key from secure storage:", error);
  }
}
