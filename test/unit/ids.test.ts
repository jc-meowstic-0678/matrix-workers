import { describe, it, expect } from 'vitest';
import {
  parseUserId,
  formatUserId,
  parseRoomId,
  parseRoomAlias,
  formatRoomAlias,
  isLocalServerName,
  isValidLocalpart,
  isValidServerName,
  getServerName,
  base64UrlEncode,
  base64UrlDecode,
} from '../../src/utils/ids';

describe('ids utilities', () => {
  describe('parseUserId', () => {
    it('should parse valid user ID', () => {
      const result = parseUserId('@alice:example.com');
      expect(result).toEqual({ localpart: 'alice', serverName: 'example.com' });
    });
    
    it('should parse user ID with port', () => {
      const result = parseUserId('@bob:example.com:8448');
      expect(result).toEqual({ localpart: 'bob', serverName: 'example.com:8448' });
    });
    
    it('should return null for invalid format', () => {
      expect(parseUserId('invalid')).toBeNull();
      expect(parseUserId('alice')).toBeNull();
      expect(parseUserId('@')).toBeNull();
    });
  });
  
  describe('formatUserId', () => {
    it('should format valid user ID', () => {
      expect(formatUserId('alice', 'example.com')).toBe('@alice:example.com');
    });
    
    it('should format with port', () => {
      expect(formatUserId('alice', 'example.com:8448')).toBe('@alice:example.com:8448');
    });
  });
  
  describe('parseRoomId', () => {
    it('should parse valid room ID', () => {
      const result = parseRoomId('!abcdef:example.com');
      expect(result).toEqual({ opaque: 'abcdef', serverName: 'example.com' });
    });
    
    it('should return null for invalid format', () => {
      expect(parseRoomId('invalid')).toBeNull();
      expect(parseRoomId('!abcdef')).toBeNull();
    });
  });
  
  describe('parseRoomAlias', () => {
    it('should parse valid room alias', () => {
      const result = parseRoomAlias('#room:example.com');
      expect(result).toEqual({ localpart: 'room', serverName: 'example.com' });
    });
    
    it('should return null for invalid format', () => {
      expect(parseRoomAlias('invalid')).toBeNull();
    });
  });
  
  describe('formatRoomAlias', () => {
    it('should format valid room alias', () => {
      expect(formatRoomAlias('room', 'example.com')).toBe('#room:example.com');
    });
  });
  
  describe('isLocalServerName', () => {
    it('should detect local server', () => {
      expect(isLocalServerName('example.com', 'example.com')).toBe(true);
    });
    
    it('should detect remote server', () => {
      expect(isLocalServerName('remote.com', 'example.com')).toBe(false);
    });
  });
  
  describe('isValidLocalpart', () => {
    it('should validate correct localpart', () => {
      expect(isValidLocalpart('alice')).toBe(true);
      expect(isValidLocalpart('user_123')).toBe(true);
    });
    
    it('should reject invalid localpart', () => {
      expect(isValidLocalpart('')).toBe(false);
      expect(isValidLocalpart('a b')).toBe(false);
    });
  });
  
  describe('isValidServerName', () => {
    it('should validate correct server name', () => {
      expect(isValidServerName('example.com')).toBe(true);
      expect(isValidServerName('sub.example.com')).toBe(true);
    });
    
    it('should validate with port', () => {
      expect(isValidServerName('example.com:8448')).toBe(true);
    });
    
    it('should reject invalid server name', () => {
      expect(isValidServerName('')).toBe(false);
    });
  });
  
  describe('getServerName', () => {
    it('should extract server name from user ID', () => {
      expect(getServerName('@alice:example.com')).toBe('example.com');
    });
    
    it('should extract server name from room ID', () => {
      expect(getServerName('!room:example.com')).toBe('example.com');
    });
    
    it('should return null for invalid ID', () => {
      expect(getServerName('invalid')).toBeNull();
    });
  });
  
  describe('base64UrlEncode / base64UrlDecode', () => {
    it('should encode and decode bytes', () => {
      const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base64UrlEncode(original);
      const decoded = base64UrlDecode(encoded);
      
      expect(decoded).toEqual(original);
    });
    
    it('should handle empty input', () => {
      expect(base64UrlEncode(new Uint8Array(0))).toBe('');
      expect(base64UrlDecode('')).toEqual(new Uint8Array(0));
    });
  });
});