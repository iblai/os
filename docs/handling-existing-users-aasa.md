# Handling Existing Users with Cached AASA Files

## The Problem

When you update the AASA file on your server to add new paths (like `/mobile-sso-login`), iOS caches the old AASA file on devices that already have your app installed. Existing users won't automatically get the updated paths.

**Example:**

- Old AASA (601 bytes): Had `/sso-login` and `/sso-login/*`
- New AASA (227 bytes): Added `/mobile-sso-login`, `/mobile/*`, `/test/*`
- Existing users: Still have the 601-byte version cached
- Result: `/sso-login` works, but `/mobile-sso-login` doesn't work for them

## Solutions for Production

### Option 1: Use Paths That Already Work (Best for Existing Users)

Since `/sso-login` already works for all users (it was in the original AASA), use that path for mobile SSO:

**Change your deep links from:**

```
https://mentorai.iblai.app/mobile-sso-login?data=xxx
```

**To:**

```
https://mentorai.iblai.app/sso-login?data=xxx&mobile=true
```

Then handle the `mobile` query param in your `/sso-login` page to apply mobile-specific logic.

**Pros:**

- Works immediately for all existing users
- No app update required
- No user action required

**Cons:**

- Need to consolidate SSO logic
- Lose semantic URL clarity

### Option 2: Use Wildcard Paths from Original AASA

If your original AASA had wildcard paths like `/mobile/*`, use those:

**Instead of:**

```
https://mentorai.iblai.app/mobile-sso-login
```

**Use:**

```
https://mentorai.iblai.app/mobile/sso-login
```

This works if `/mobile/*` was in the original AASA.

**Check what was in your original AASA:**

- If it had `/mobile/*` wildcard → Use `/mobile/sso-login`
- If not → This won't work for existing users

### Option 3: Version Bump + App Update (Partial Solution)

Bump the app version and distribute through TestFlight/App Store:

```bash
cd apps/mentor
./scripts/bump-version.sh 1.1.8
```

Then archive and distribute the new version. **Some reports suggest** iOS re-validates AASA when users update to a new version, but this is **not guaranteed** by Apple.

**Pros:**

- May refresh AASA for users who update
- Good practice anyway for other fixes

**Cons:**

- Not guaranteed to work
- Requires users to update their app
- Takes time for users to receive update

### Option 4: Custom URL Scheme Fallback (Most Reliable)

Use your custom URL scheme as a fallback since it **always works immediately** without any AASA validation:

**Primary link (universal link):**

```
https://mentorai.iblai.app/mobile-sso-login?data=xxx
```

**Fallback (custom URL scheme):**

```
iblai://mentorai/mobile-sso-login?data=xxx
```

**Implementation:**

- Try universal link first
- If app doesn't open within 2 seconds, redirect to custom URL scheme
- Custom URL schemes work on all devices immediately

**Example HTML:**

```html
<a
  href="https://mentorai.iblai.app/mobile-sso-login?data=xxx"
  onclick="setTimeout(() => { window.location='iblai://mentorai/mobile-sso-login?data=xxx' }, 2000)"
>
  Open in ibl.ai OS
</a>
```

**Pros:**

- Works for 100% of users immediately
- No app update required
- No waiting for iOS validation

**Cons:**

- Less elegant (shows app scheme in URL briefly)
- Requires client-side JavaScript logic

### Option 5: Wait for iOS Automatic Refresh (Slow)

iOS periodically re-validates AASA files, but Apple doesn't document when. Reports suggest:

- May happen after several days to weeks
- May happen when device restarts
- May happen when iOS updates
- **Very unpredictable**

**Pros:**

- No action required

**Cons:**

- Takes days/weeks
- Unpredictable timing
- No control over the process

## Recommended Strategy for Production

**For new deployments:**

1. **Use paths from the original AASA** (like `/sso-login`) with query params to differentiate mobile vs web
2. **OR** rely on **custom URL schemes** (`iblai://`) which work immediately for all users
3. Add new universal link paths in AASA for future users, but don't depend on them for existing users

**For existing `/mobile-sso-login` links:**

1. **Short term:** Create a server-side redirect from `/mobile-sso-login` to `/sso-login?mobile=true`
2. **OR** use custom URL scheme fallback: `iblai://mentorai/mobile-sso-login`
3. **Long term:** Wait for iOS to naturally refresh (weeks) or for users to update app

## Testing the Cached AASA

To verify what version iOS cached on a device:

```bash
cd apps/mentor
./scripts/check-cached-aasa.sh
```

Then check Console.app logs for `response_bytes=XXX` to see the cached file size.

**Current server AASA:** 227 bytes
**Old cached AASA:** 601 bytes

If `response_bytes` doesn't match the server size, iOS has an old cached version.

## Force Refresh for Testing (Not for End Users)

For your own testing devices, you can force a fresh AASA download:

```bash
cd apps/mentor
./scripts/force-aasa-refresh.sh
```

But **don't ask end users to do this** - it requires deleting the app, restarting device, and reinstalling.

## Best Practices Going Forward

1. **Only add paths, never remove** - Removing paths breaks older app versions
2. **Use wildcards from day 1** - `/*` works for all paths
3. **Test with custom URL schemes first** - They work immediately for development
4. **Don't rely on new AASA paths for existing users** - Assume they have the old cached version
5. **Version your AASA changes** - Keep track of what paths were added when

## Summary

| Solution                   | Works for Existing Users? | Requires App Update? | Effort |
| -------------------------- | ------------------------- | -------------------- | ------ |
| Use `/sso-login` instead   | ✅ Yes, immediately       | ❌ No                | Low    |
| Use wildcard paths         | ✅ If in original AASA    | ❌ No                | Low    |
| Version bump               | ⚠️ Maybe                  | ✅ Yes               | Medium |
| Custom URL scheme fallback | ✅ Yes, immediately       | ❌ No                | Medium |
| Wait for iOS refresh       | ⏳ Eventually             | ❌ No                | Low    |

**Recommended:** Use `/sso-login` for all SSO operations or implement custom URL scheme fallback.
