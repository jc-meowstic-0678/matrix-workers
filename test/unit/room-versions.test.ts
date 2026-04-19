import { describe, it, expect } from 'vitest';
import {
  getRoomVersion,
  isRoomVersionSupported,
  getDefaultRoomVersion,
  getSupportedRoomVersions,
  getRedactionAllowedKeys,
} from '../../src/services/room-versions';

describe('room-versions service', () => {
  describe('getRoomVersion', () => {
    it('should return null for invalid version', () => {
      const version = getRoomVersion('invalid');
      expect(version).toBeNull();
    });
    
    it('should return null for empty string', () => {
      const version = getRoomVersion('');
      expect(version).toBeNull();
    });
    
    it('should return correct version for valid input', () => {
      const version = getRoomVersion('6');
      expect(version).not.toBeNull();
      expect(version?.version).toBe('6');
      expect(version?.stable).toBe(true);
    });
    
    it('should handle v10 correctly', () => {
      const version = getRoomVersion('10');
      expect(version).not.toBeNull();
      expect(version?.version).toBe('10');
      expect(version?.stateResolution).toBe('v2');
      expect(version?.knockRestrictedSupported).toBe(true);
    });
  });
  
  describe('isRoomVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(isRoomVersionSupported('1')).toBe(true);
      expect(isRoomVersionSupported('6')).toBe(true);
      expect(isRoomVersionSupported('10')).toBe(true);
    });
    
    it('should return false for unsupported versions', () => {
      expect(isRoomVersionSupported('0')).toBe(false);
      expect(isRoomVersionSupported('999')).toBe(false);
    });
  });
  
  describe('getDefaultRoomVersion', () => {
    it('should return version 10', () => {
      expect(getDefaultRoomVersion()).toBe('10');
    });
  });
  
  describe('getSupportedRoomVersions', () => {
    it('should return all versions with stability', () => {
      const versions = getSupportedRoomVersions();
      
      expect(versions['1']).toBe('stable');
      expect(versions['10']).toBe('stable');
    });
  });
  
  describe('getRedactionAllowedKeys', () => {
    it('should return keys for custom event type', () => {
      const version = getRoomVersion('10');
      expect(version).not.toBeNull();
      const keys = getRedactionAllowedKeys('custom.event', version!);
      
      expect(keys).toContain('event_id');
      expect(keys).toContain('sender');
    });
    
    it('should include membership for m.room.member', () => {
      const version = getRoomVersion('10');
      expect(version).not.toBeNull();
      const keys = getRedactionAllowedKeys('m.room.member', version!);
      
      expect(keys).toContain('membership');
    });
    
    it('should include creator for m.room.create', () => {
      const version = getRoomVersion('6');
      expect(version).not.toBeNull();
      const keys = getRedactionAllowedKeys('m.room.create', version!);
      
      expect(keys).toContain('creator');
    });
    
    it('should include power level settings', () => {
      const version = getRoomVersion('10');
      expect(version).not.toBeNull();
      const keys = getRedactionAllowedKeys('m.room.power_levels', version!);
      
      expect(keys).toContain('ban');
      expect(keys).toContain('invite');
    });
  });
});