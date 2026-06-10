import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  canWriteField,
  pickWritableFields,
  rbacPermissionToDisplay,
} from '../index';

// Control config.enableRBAC() for the default-parameter code paths.
let mockEnableRBAC = false;
vi.mock('@/lib/config', () => ({
  config: {
    enableRBAC: () => mockEnableRBAC,
  },
}));

beforeEach(() => {
  mockEnableRBAC = false;
});

describe('canWriteField', () => {
  it('honours an explicit write:false entry even when the RBAC flag is off', () => {
    // Mirrors WithFormPermissions: a present entry is authoritative regardless
    // of the RBAC config flag, so a disabled control is never sent.
    expect(
      canWriteField(
        { mentor_visibility: { read: true, write: false } },
        'mentor_visibility',
        false,
      ),
    ).toBe(false);
  });

  it('honours the write flag for a gated field when RBAC is enabled', () => {
    const permissions = {
      mentor_visibility: { read: true, write: false },
      mentor_name: { read: true, write: true },
    };
    expect(canWriteField(permissions, 'mentor_visibility', true)).toBe(false);
    expect(canWriteField(permissions, 'mentor_name', true)).toBe(true);
  });

  it('treats a field absent from the map as writable when RBAC is off', () => {
    expect(
      canWriteField(
        { mentor_name: { read: true, write: true } },
        'some_ungated_field',
        false,
      ),
    ).toBe(true);
  });

  it('treats a field absent from the map as not writable when RBAC is on', () => {
    // Matches the WithFormPermissions default of { write: !enableRBAC } for
    // fields the endpoint does not describe (the control is hidden/disabled).
    expect(
      canWriteField(
        { mentor_name: { read: true, write: true } },
        'some_ungated_field',
        true,
      ),
    ).toBe(false);
  });

  it('treats a write flag that is not strictly true as not writable', () => {
    // read-only entries may omit `write` entirely
    expect(
      canWriteField({ enable_claw: { read: true } }, 'enable_claw', true),
    ).toBe(false);
    expect(
      canWriteField({ enable_claw: { read: true } }, 'enable_claw', false),
    ).toBe(false);
  });

  it('falls back to writable for unknown fields when permissions are undefined and RBAC is off', () => {
    expect(canWriteField(undefined, 'mentor_visibility', false)).toBe(true);
  });

  it('falls back to not-writable for unknown fields when permissions are undefined and RBAC is on', () => {
    expect(canWriteField(undefined, 'mentor_visibility', true)).toBe(false);
  });

  it('falls back to config.enableRBAC() for the absent-field default', () => {
    mockEnableRBAC = false;
    expect(canWriteField(undefined, 'mentor_visibility')).toBe(true);
    mockEnableRBAC = true;
    expect(canWriteField(undefined, 'mentor_visibility')).toBe(false);
  });
});

describe('pickWritableFields', () => {
  const permissions = {
    mentor_name: { read: true, write: true },
    mentor_visibility: { read: true, write: false },
    enable_claw: { read: true, write: false },
    profile_image: { read: true, write: false },
    metadata: { read: true, write: true },
  };

  it('strips explicit read-only fields even when the RBAC flag is off', () => {
    const payload = {
      mentor_name: 'Bot', // present, write:true → kept
      mentor_visibility: 'x', // present, write:false → dropped
      enable_claw: true, // present, write:false → dropped
    };
    expect(
      pickWritableFields(payload, permissions, { enableRBAC: false }),
    ).toEqual({ mentor_name: 'Bot' });
  });

  it('keeps ungated fields when RBAC is off but strips them when RBAC is on', () => {
    const payload = {
      mentor_name: 'Bot', // present, write:true → always kept
      enable_multi_query_rag: true, // absent from the map
    };
    expect(
      pickWritableFields(payload, permissions, { enableRBAC: false }),
    ).toEqual({ mentor_name: 'Bot', enable_multi_query_rag: true });
    expect(
      pickWritableFields(payload, permissions, { enableRBAC: true }),
    ).toEqual({ mentor_name: 'Bot' });
  });

  it('maps payload keys to differently-named permission keys', () => {
    const payload = {
      uploaded_profile_image: 'file',
      categories: 7,
    };
    const result = pickWritableFields(payload, permissions, {
      enableRBAC: true,
      fieldNameMap: {
        uploaded_profile_image: 'profile_image', // write:false → dropped
        categories: 'metadata', // write:true → kept
      },
    });
    expect(result).toEqual({ categories: 7 });
  });

  it('returns an empty object when every field is read-only', () => {
    const payload = { mentor_visibility: 'x', enable_claw: true };
    expect(
      pickWritableFields(payload, permissions, { enableRBAC: true }),
    ).toEqual({});
  });

  it('uses config.enableRBAC() when the flag is omitted', () => {
    const payload = { mentor_visibility: 'x', mentor_name: 'Bot' };
    mockEnableRBAC = true;
    expect(pickWritableFields(payload, permissions)).toEqual({
      mentor_name: 'Bot',
    });
  });
});

describe('rbacPermissionToDisplay', () => {
  it('returns true when RBAC is disabled', () => {
    mockEnableRBAC = false;
    expect(
      rbacPermissionToDisplay(['a'], { a: { read: false, write: false } }),
    ).toBe(true);
  });

  it('returns true when no permission fields are requested', () => {
    mockEnableRBAC = true;
    expect(
      rbacPermissionToDisplay([], { a: { read: true, write: true } }),
    ).toBe(true);
  });

  it('returns true only when at least one requested field is readable', () => {
    mockEnableRBAC = true;
    expect(
      rbacPermissionToDisplay(['a', 'b'], {
        a: { read: false, write: false },
        b: { read: true, write: false },
      }),
    ).toBe(true);
    expect(
      rbacPermissionToDisplay(['a'], { a: { read: false, write: false } }),
    ).toBe(false);
  });
});
