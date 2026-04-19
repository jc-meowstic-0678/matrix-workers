import { describe, it, expect } from 'vitest';
import { Errors } from '../../src/utils/errors';

describe('errors utilities', () => {
  describe('MatrixApiError', () => {
    it('should create not found error', () => {
      const error = Errors.notFound('User not found');
      
      expect(error.errcode).toBe('M_NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
    
    it('should create forbidden error', () => {
      const error = Errors.forbidden('Access denied');
      
      expect(error.errcode).toBe('M_FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });
    
    it('should create unknown error', () => {
      const error = Errors.unknown('Something went wrong');
      
      expect(error.errcode).toBe('M_UNKNOWN');
      expect(error.message).toBe('Something went wrong');
    });
    
    it('should create bad JSON error', () => {
      const error = Errors.badJson();
      
      expect(error.errcode).toBe('M_BAD_JSON');
    });
    
    it('should create limit exceeded error', () => {
      const error = Errors.limitExceeded('Rate limited');
      
      expect(error.errcode).toBe('M_LIMIT_EXCEEDED');
    });
    
    it('should convert to JSON response', () => {
      const error = Errors.notFound('Not found');
      const response = error.toResponse();
      
      expect(response.status).toBe(404);
    });
    
    it('should convert to JSON body', () => {
      const error = Errors.notFound('Not found');
      const body = error.toJSON();
      
      expect(body).toEqual({
        errcode: 'M_NOT_FOUND',
        error: 'Not found',
      });
    });
    
    it('should set correct status codes', () => {
      expect(Errors.forbidden().status).toBe(403);
      expect(Errors.notFound().status).toBe(404);
      expect(Errors.badJson().status).toBe(400);
      expect(Errors.missingToken().status).toBe(401);
    });
  });
});