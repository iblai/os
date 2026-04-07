# TestFlight Universal Links Setup & Testing

## Step 1: Clean Install from TestFlight

### Remove Old App Completely

1. **Delete any existing version** of the app from your iPhone
   - Long-press app icon → Remove App → Delete App
2. **Restart your iPhone** (important - clears iOS caches)
   - Hold power button → Slide to power off
   - Wait 10 seconds
   - Power on

### Install from TestFlight

1. Open **TestFlight** app on your iPhone
2. Find **ibl.ai OS**
3. Tap **Install**
4. Wait for installation to complete
5. **IMPORTANT: Wait 2-5 minutes** after installation
   - iOS validates the AASA file in the background
   - Keep iPhone connected to WiFi
   - Don't open the app immediately

## Step 2: Test Universal Links (CORRECT METHOD)

### ❌ WRONG: Safari Address Bar

Don't type or paste the URL in Safari's address bar - this will NEVER work. It's an iOS security feature.

### ✅ CORRECT: Test from External Source

**Option A: Notes App (Recommended)**

1. Open **Notes** app
2. Create a new note
3. Type: `https://mentorai.iblai.app/mobile-sso-login?data=test123`
4. Tap the link
5. **Expected result**: Banner appears "Open in ibl.ai OS" → App opens

**Option B: Messages**

1. Send yourself an iMessage
2. Include: `https://mentorai.iblai.app/mobile-sso-login?data=test123`
3. Tap the link in the message
4. App should open

**Option C: Mail**

1. Email yourself the link
2. Tap it in the Mail app
3. App should open

**Option D: Safari Smart Banner Method**

1. Visit `https://mentorai.iblai.app/mobile-sso-login?data=test123` in Safari
2. **Long-press** the address bar (not just tap)
3. Select **"Open"** from the menu
4. App should open

## Step 3: Verify Universal Link Configuration

### Check iOS Settings

After installing from TestFlight:

1. Go to **Settings** → scroll down to **ibl.ai OS**
2. Look for associated domains info
3. Should show `mentorai.iblai.app`

### Debug with Console.app (If Still Not Working)

**On Mac:**

1. Connect iPhone to Mac via cable
2. Open **Console.app** (in /Applications/Utilities/)
3. Select your iPhone in the sidebar
4. In the search box, type: `swcd`
5. Click **Start** to stream logs
6. On iPhone: Delete the app
7. Reinstall from TestFlight
8. Watch Console for AASA validation messages

**Look for:**

- `"Fetching apple-app-site-association for domain mentorai.iblai.app"`
- `"Successfully downloaded"`
- `"Validated successfully"`

**Red flags:**

- `"Failed to download"`
- `"Invalid JSON"`
- `"Certificate error"`
- `"Domain not approved"`

## Step 4: Common Issues & Solutions

### Issue: Links open in Safari instead of app

**Cause 1: Tested from Safari address bar**

- Solution: Use Notes app or Messages

**Cause 2: iOS hasn't validated AASA yet**

- Solution: Wait 5-10 minutes after installation, keep WiFi on

**Cause 3: App was installed, then AASA was updated**

- Solution: Delete app, wait 1 minute, reinstall from TestFlight

**Cause 4: Same-domain navigation**

- Solution: Universal links don't work when navigating within the same domain
- Example: If you're on mentorai.iblai.app in Safari, tapping a mentorai.iblai.app link won't open the app

**Cause 5: User previously chose "Open in Safari"**

- iOS remembers this choice per domain
- Solution:
  1. Long-press the link
  2. Select "Open in [App Name]" instead of just tapping
  3. This resets the preference

### Issue: Enterprise domain error in logs

This is **NORMAL** and can be ignored. It just means your device isn't managed by an enterprise MDM system.

### Issue: Still doesn't work after everything

**Last resort solutions:**

1. **Factory reset AASA cache** (requires development mode):

   ```bash
   # On Mac with iPhone connected
   xcrun simctl privacy booted reset all
   ```

2. **Use custom URL schemes for testing**:

   - `iblai://mentorai/mobile-sso-login?data=test123`
   - This works immediately without any validation

3. **Check domain in different network**:
   - Switch from WiFi to cellular data
   - iOS sometimes caches DNS differently

## Step 5: Test Links

Copy these to Notes app and tap them:

### Universal Link (https://)

```
https://mentorai.iblai.app/mobile-sso-login?data=test123
```

### Custom URL Scheme (iblai://)

```
iblai://mentorai/mobile-sso-login?data=test123
```

Both should open the app - if only the second one works, universal links aren't validated yet.

## Expected Behavior

### On First Tap of Universal Link:

- iOS shows banner: "Open in ibl.ai OS"
- You can tap banner or the link
- App opens to the deep link path

### On Subsequent Taps:

- App opens immediately (if you chose "Open in App" before)
- OR banner shows again (if you chose "Open in Safari" before)

## Troubleshooting Checklist

- [ ] Completely deleted old development app
- [ ] Restarted iPhone
- [ ] Installed fresh from TestFlight
- [ ] Waited 5+ minutes after installation
- [ ] Tested from Notes app (not Safari address bar)
- [ ] Verified AASA file is accessible: https://mentorai.iblai.app/.well-known/apple-app-site-association
- [ ] Checked Console.app logs during installation
- [ ] Custom URL scheme works (proves deep linking is configured)
- [ ] Same domain issue ruled out (not testing from mentorai.iblai.app site)

## Still Not Working?

If universal links still don't work after all of this:

1. **Verify AASA is being served correctly**:

   ```bash
   curl -I https://mentorai.iblai.app/.well-known/apple-app-site-association
   # Should show: Content-Type: application/json
   # Should NOT redirect
   ```

2. **Validate AASA content**:

   - App ID: `L4FWRM8W5Z.ai.ibl.mentorai`
   - Paths include: `/mobile-sso-login`

3. **Use Apple's validation tool**:

   - Visit: https://search.developer.apple.com/appsearch-validation-tool/
   - Enter your domain: mentorai.iblai.app
   - Check if AASA is valid

4. **Fallback to custom URL schemes**:
   - For development/testing, use `iblai://`
   - For production, both should work
   - Your app already supports both!

---

**Remember**: Universal links are notoriously finicky with development builds. TestFlight builds are much more reliable!
