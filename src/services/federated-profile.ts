// Federated profile lookup service
// Enables looking up user profiles from remote Matrix servers

import type { Env } from '../types';
import { discoverServer, buildServerUrl } from './server-discovery';
import { fetchRemoteServerKeys } from './federation-keys';

interface FederatedProfile {
  displayname: string | null;
  avatar_url: string | null;
}

interface ProfileResponse {
  displayname?: string | null;
  avatar_url?: string | null;
}

/**
 * Fetch a user profile from a remote Matrix server via federation
 */
export async function fetchFederatedProfile(
  userId: string,
  db: any,
  cache: any,
  env: Env
): Promise<FederatedProfile | null> {
  // Parse the user ID to get the server name
  const atIdx = userId.indexOf(':');
  if (atIdx === -1) {
    return null;
  }
  
  const serverName = userId.substring(atIdx + 1);
  const localServer = env.SERVER_NAME;
  
  // Don't try to federate with ourselves
  if (serverName === localServer) {
    return null;
  }
  
  try {
    // Discover the remote server
    const discovery = await discoverServer(serverName, cache);
    const serverUrl = buildServerUrl(discovery);
    
    // Fetch remote server keys for verification
    const serverKeys = await fetchRemoteServerKeys(serverName, db, cache);
    if (serverKeys.length === 0) {
      console.warn(`[federated-profile] No keys for ${serverName}`);
      return null;
    }
    
    // Build the request URL
    const encodedUserId = encodeURIComponent(userId);
    const profileUrl = `${serverUrl}/_matrix/federation/v1/query/profile?user_id=${encodedUserId}`;
    
    // Fetch the profile
    const response = await fetch(profileUrl, {
      headers: {
        Accept: 'application/json',
      },
      cf: {
        cacheTtl: 300, // Cache at edge for 5 minutes
        cacheEverything: true,
      },
    });
    
    if (!response.ok) {
      console.warn(`[federated-profile] HTTP ${response.status} from ${serverName}`);
      return null;
    }
    
    const profileData = await response.json() as ProfileResponse;
    
    // Validate the response
    if (!profileData || typeof profileData !== 'object') {
      console.warn(`[federated-profile] Invalid response from ${serverName}`);
      return null;
    }
    
    return {
      displayname: profileData.displayname ?? null,
      avatar_url: profileData.avatar_url ?? null,
    };
  } catch (error) {
    console.error(`[federated-profile] Failed to fetch profile for ${userId}:`, error);
    return null;
  }
}