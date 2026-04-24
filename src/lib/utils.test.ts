import { describe, it, expect } from 'vitest';
import { createId, formatDate, cn } from './utils';

describe('utils', () => {
  describe('createId', () => {
    it('should create a valid UUID', () => {
      const id = createId();

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(36); // UUID v4 length
      expect(id).toMatch(/^[0-9a-f-]+$/); // UUID format
    });

    it('should create unique IDs', () => {
      const id1 = createId();
      const id2 = createId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('formatDate', () => {
    it('should format ISO string', () => {
      const date = '2024-01-15T10:30:00Z';
      const formatted = formatDate(date);

      expect(formatted).toContain('01');
      expect(formatted).toContain('2024');
    });

    it('should format Date object', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);

      expect(formatted).toContain('01');
      expect(formatted).toContain('2024');
    });

    it('should handle invalid date gracefully', () => {
      const formatted = formatDate('invalid');
      expect(formatted).toBe('Invalid Date');
    });
  });

  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', false && 'hidden', true && 'active');
      expect(result).toBe('base active');
    });

    it('should join tailwind classes', () => {
      const result = cn('px-2 py-1', 'px-4');
      expect(result).toBe('px-2 py-1 px-4'); // clsx joins, doesn't merge
    });
  });
});
