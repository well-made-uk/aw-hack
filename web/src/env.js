import { defineEnvVars } from '@sveltejs/kit/env';

/** @param {string | undefined} value */
const optional = (value) => value || undefined;

// All server-only. Without APPWRITE_PROJECT_ID / APPWRITE_API_KEY the app serves a demo crate.
export const variables = defineEnvVars({
	APPWRITE_ENDPOINT: { schema: (value) => value || 'https://cloud.appwrite.io/v1' },
	APPWRITE_PROJECT_ID: { schema: optional },
	APPWRITE_API_KEY: { schema: optional },
	VECTORS_DATABASE_ID: { schema: (value) => value || 'nexttrack' },
	TRACKS_COLLECTION_ID: { schema: (value) => value || 'tracks' }
});
