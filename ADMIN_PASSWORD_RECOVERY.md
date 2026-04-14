# Admin Access Recovery Guide

## Setting Up Master Password

The master password provides emergency access to the admin panel if you forget your regular password.

### Step 1: Generate Master Password Hash

Run this command to generate a SHA256 hash of your master password:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('YOUR_MASTER_PASSWORD_HERE').digest('hex'))"
```

Replace `YOUR_MASTER_PASSWORD_HERE` with your desired master password.

Example output:
```
5e884898da28047151d0e56f8dc629100987b3b77d9dbc6ec3e9c7a7c6c6f0c4
```

### Step 2: Add to Environment Variables

Add the hash to your `.env.local` file (for local development) or Vercel environment variables:

```
ADMIN_MASTER_PASSWORD_HASH=5e884898da28047151d0e56f8dc629100987b3b77d9dbc6ec3e9c7a7c6c6f0c4
```

### Step 3: Test Master Password Login

1. Go to `/login`
2. Click "Admin? Sign in with password →"
3. If you forgot your password, click "Forgot password?"
4. Then click "Use Master Password"
5. Enter your admin email and master password

## Password Recovery Flow

### Option 1: Email Reset (Recommended)
- Go to `/login`
- Click "Admin? Sign in with password →"
- Click "Forgot password?"
- Enter your email
- Check your email for a reset link
- Set a new password

### Option 2: Master Password
- Only use if you can't access email
- Go to `/login` → "Forgot password?" → "Use Master Password"
- Enter your master password to gain access
- Then change your password in admin settings

## Important Security Notes

- Keep your master password VERY SECURE
- Never commit the hash to version control (use environment variables)
- Master password is NOT stored in the database - only as an environment variable
- The master password should be different from your regular admin password
- Share the master password ONLY with trusted admins
- Regenerate the hash if you suspect compromise

## Resetting Your Admin Password

Once logged in via master password:

1. Go to `/admin/settings`
2. Look for "Change Password" section
3. Enter your new password
4. Save changes

You can now login with your new password.
