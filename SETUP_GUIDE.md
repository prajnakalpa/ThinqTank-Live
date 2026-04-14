# ThinqTank Live - Setup & Configuration Guide

## OTP Email Configuration (Supabase)

To make the OTP code visible in the email sent to users:

### Step 1: Go to Supabase Console
1. Navigate to https://app.supabase.com/
2. Select your project (mhhscvmypriujtoorgap)
3. Go to **Authentication** → **Email Templates**

### Step 2: Edit the OTP Template
1. Find and click on **Magic Link / OTP Template**
2. Look for the email template editor
3. The OTP code should be visible in the email. If it's not:
   - Make sure the template includes `{{ token }}`
   - The template should display the 6-digit code clearly

### Step 3: Verify Email Settings
1. Go to **Authentication** → **Providers**
2. Click on **Email**
3. Ensure "Confirm email" is enabled
4. Test by sending yourself an OTP - you should see the 6-digit code

---

## Master Password Configuration

Your current master password is: `thinqtankadmin`

### Change Your Master Password:
1. Log in to admin panel with master password
2. Go to **Settings** → **Master Password**
3. Enter current password and new password
4. After updating, go to Vercel project settings and update `ADMIN_MASTER_PASSWORD` environment variable

### Steps to Update Environment Variable:
1. Go to https://vercel.com/prajnakalpa-3183s-projects/thinq-tank-live/settings/environment-variables
2. Find `ADMIN_MASTER_PASSWORD`
3. Update the value to your new password
4. Click Save and redeploy

---

## Login Options

### For Students:
- Use email OTP (automatic account creation)
- Code sent via email, valid for 10 minutes
- Can resend if expired

### For Admins:
- **Option 1**: Admin password (requires email account setup)
- **Option 2**: Master password (emergency access, no email needed)
- Master password can be used from login page: "Admin? Sign in with password" → "Forgot password?" → "Use Master Password"

---

## Security Notes

- Master password is stored in environment variables (plaintext recommended for simplicity)
- For production, consider:
  - Hashing the master password
  - Using role-based access control
  - Implementing audit logging
  - Adding IP whitelisting for admin access

---

## Troubleshooting

**OTP not appearing in email:**
- Check Supabase email template (may need to verify sender email is confirmed)
- Check spam/junk folder
- Resend the code after waiting 30 seconds

**Can't access admin panel:**
- Try master password first
- If that doesn't work, check `ADMIN_MASTER_PASSWORD` env var is set
- Verify your email exists in users table with role='admin'

**Email password reset not working:**
- Verify Supabase is configured to send password reset emails
- Check email templates in Supabase console
- Test with Supabase directly first
