// Shared type definitions for admin module

import type { Context } from 'hono';
import type { Env } from '../types';

// ============================================
// API Types
// ============================================

export interface AdminContext {
  userId: string;
  token: string;
}

export interface User {
  user_id: string;
  localpart: string;
  display_name?: string;
  avatar_url?: string;
  admin: boolean;
  is_deactivated: boolean;
  created_at: number;
  devices?: Device[];
  rooms?: RoomMembership[];
}

export interface Device {
  device_id: string;
  display_name?: string;
  last_seen_ts?: number;
  last_seen_ip?: string;
}

export interface RoomMembership {
  room_id: string;
  membership: string;
}

export interface Room {
  room_id: string;
  name?: string;
  topic?: string;
  avatar_url?: string;
  room_version: string;
  is_public: boolean;
  creator_id?: string;
  member_count: number;
  event_count: number;
  created_at: number;
  aliases?: string[];
  join_rule?: string;
}

export interface Media {
  media_id: string;
  user_id: string;
  content_type: string;
  content_length: number;
  filename?: string;
  created_at: number;
  quarantined: boolean;
}

export interface Report {
  id: number;
  reporter_user_id: string;
  reported_user_id?: string;
  room_id?: string;
  event_id?: string;
  reason: string;
  score: number;
  created_at: number;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: number;
  resolution_note?: string;
}

export interface FederationServer {
  server_name: string;
  last_successful_fetch?: number;
  retry_count: number;
}

export interface FederationTest {
  name: string;
  passed: boolean;
  message: string;
}

export interface ServerStats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  federationOk: boolean;
  knownServers?: number;
  mediaCount?: number;
  mediaSize?: number;
  unresolvedReports?: number;
}

// ============================================
// Request/Response Types
// ============================================

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  expires_in?: number;
  error?: string;
}

export interface StatusResponse {
  authenticated: boolean;
  server_name: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  admin?: boolean;
  display_name?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user_id: string;
}

export interface UpdateUserRequest {
  display_name?: string;
  admin?: boolean;
  deactivated?: boolean;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface CreateRoomRequest {
  name?: string;
  room_alias_local_part?: string;
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat';
  topic?: string;
}

export interface CreateRoomResponse {
  room_id: string;
  room_alias?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next_offset?: number;
}

// ============================================
// UI Types
// ============================================

export interface ViewState {
  currentView: string;
  page: number;
  search: string;
  filters: Record<string, any>;
}

export interface ModalState {
  visible: boolean;
  data?: any;
  error?: string;
}

// ============================================
// Hono Context Helpers
// ============================================

export interface AdminRequestContext {
  userId: string;
  isAdmin: boolean;
}

export type AdminContext = Context & {
  get(key: 'userId'): string;
  get(key: 'isAdmin'): boolean;
};

// ============================================
// Constants
// ============================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
export const SESSION_TTL = 86400; // 24 hours