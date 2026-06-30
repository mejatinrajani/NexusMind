// src/lib/appwrite.js
import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client();

client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const CONFIG = {
    DATABASE_ID: import.meta.env.VITE_APPWRITE_DATABASE_ID,
    COLLECTIONS: {
        CHATBOTS: import.meta.env.VITE_APPWRITE_COLLECTION_CHATBOTS,
        THREADS: import.meta.env.VITE_APPWRITE_COLLECTION_THREADS,
        MESSAGES: import.meta.env.VITE_APPWRITE_COLLECTION_MESSAGES,
        DOCUMENTS: import.meta.env.VITE_APPWRITE_COLLECTION_DOCUMENTS,
    },
    BUCKETS: {
        DOCUMENTS: import.meta.env.VITE_APPWRITE_BUCKET_DOCUMENTS,
    }
};