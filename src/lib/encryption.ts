// End-to-end encryption utilities using Web Crypto API

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

// Generate a new key pair for E2E encryption
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKeyBuffer),
    privateKey: arrayBufferToBase64(privateKeyBuffer),
  };
}

// Generate a symmetric key for message encryption
async function generateSymmetricKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a message using hybrid encryption (AES + RSA)
export async function encryptMessage(message: string, recipientPublicKey: string): Promise<string> {
  try {
    // Generate a symmetric key for this message
    const symmetricKey = await generateSymmetricKey();
    
    // Encrypt the message with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    
    const encryptedMessage = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      symmetricKey,
      messageBuffer
    );

    // Export the symmetric key
    const symmetricKeyBuffer = await window.crypto.subtle.exportKey("raw", symmetricKey);

    // Import recipient's public key
    const publicKey = await importPublicKey(recipientPublicKey);

    // Encrypt the symmetric key with RSA
    const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      symmetricKeyBuffer
    );

    // Combine all parts: iv + encryptedSymmetricKey + encryptedMessage
    const combined = {
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      encryptedKey: arrayBufferToBase64(encryptedSymmetricKey),
      encryptedMessage: arrayBufferToBase64(encryptedMessage),
    };

    return JSON.stringify(combined);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt message");
  }
}

// Decrypt a message using the private key
export async function decryptMessage(encryptedData: string, privateKeyBase64: string): Promise<string> {
  try {
    const { iv, encryptedKey, encryptedMessage } = JSON.parse(encryptedData);

    // Import private key
    const privateKey = await importPrivateKey(privateKeyBase64);

    // Decrypt the symmetric key
    const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToArrayBuffer(encryptedKey)
    );

    // Import the symmetric key
    const symmetricKey = await window.crypto.subtle.importKey(
      "raw",
      symmetricKeyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Decrypt the message
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
      symmetricKey,
      base64ToArrayBuffer(encryptedMessage)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Unable to decrypt message]";
  }
}

// Import a public key from base64
async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "spki",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

// Import a private key from base64
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Store private key securely in browser storage
export function storePrivateKey(privateKey: string): void {
  localStorage.setItem("secure_chat_private_key", privateKey);
}

// Retrieve private key from storage
export function getPrivateKey(): string | null {
  return localStorage.getItem("secure_chat_private_key");
}

// Clear private key from storage
export function clearPrivateKey(): void {
  localStorage.removeItem("secure_chat_private_key");
}
