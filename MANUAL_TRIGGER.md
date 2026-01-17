# Manual DCA Trigger Guide

This guide explains how to manually trigger your DCA function using time-based HMAC signatures.

## 🔐 Security

The manual trigger uses **HMAC-SHA256 signatures** with timestamps to provide:
- ✅ **No secret rotation needed** - Keep one permanent secret
- ✅ **Auto-expiring requests** - Each URL valid for only 5 minutes
- ✅ **Replay attack prevention** - Each timestamp can only be used once
- ✅ **Offline generation** - Generate URLs on your local machine

## 📋 Setup (One-Time)

Set the `MANUAL_DCA_SECRET` environment variable in Netlify:

```bash
MANUAL_DCA_SECRET=your-permanent-secret-here
```

**Keep this secret safe!** You'll use it to generate signatures offline.

## 🚀 Quick Usage

### Option 1: Use the Helper Script (Easiest)

```bash
# Make sure you're in the project directory
cd valr-dca-serverless

# Generate a URL that executes DCA immediately
./generate-dca-url.sh YOUR_SECRET force

# Or generate a URL that respects DCA_EXECUTION_HOUR
./generate-dca-url.sh YOUR_SECRET
```

The script will output a complete URL you can paste into your browser or use with curl.

### Option 2: Manual Generation

1. **Get current timestamp** (Unix seconds):
   ```bash
   date +%s
   # Output: 1768631176
   ```

2. **Generate signature**:
   ```bash
   echo -n "1768631176" | openssl dgst -sha256 -hmac "YOUR_SECRET" | cut -d' ' -f2
   # Output: b215151d7e61541aa417c207c1f4f8e094fd0a98876b17b36c8dc7d48a329a92
   ```

3. **Build URL**:
   ```
   https://your-site.netlify.app/.netlify/functions/manual-dca?timestamp=1768631176&signature=b215151d7e61541aa417c207c1f4f8e094fd0a98876b17b36c8dc7d48a329a92&force=true
   ```

4. **Use within 5 minutes** (or it expires)

## 🎯 URL Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `timestamp` | ✅ Yes | Unix timestamp in seconds (from `date +%s`) |
| `signature` | ✅ Yes | HMAC-SHA256 of timestamp using your secret |
| `force` | ❌ Optional | Set to `true` to execute immediately, bypassing `DCA_EXECUTION_HOUR` |

## ✅ Examples

### Execute DCA Immediately (Most Common)
```bash
./generate-dca-url.sh my-secret force
```

### Check if DCA Would Execute (Respects Hour Setting)
```bash
./generate-dca-url.sh my-secret
```

## 🛡️ Security Features

### Time Window Validation
- Requests expire after **5 minutes**
- Prevents old URLs from being reused
- Automatically handled by the function

### Signature Validation
- Uses HMAC-SHA256 cryptographic hash
- Signature = `HMAC-SHA256(timestamp, secret)`
- Invalid signatures are rejected

### What Gets Logged
- ✅ Timestamp age (for expired requests)
- ✅ Authentication success/failure
- ❌ Never logs your secret
- ❌ Never logs valid signatures in full

## ⚠️ Troubleshooting

### "Request expired"
Your timestamp is more than 5 minutes old. Generate a new URL.

### "Invalid signature"
- Check you're using the correct secret (matches `MANUAL_DCA_SECRET` in Netlify)
- Make sure timestamp exactly matches what you used to generate signature
- No extra whitespace or newlines

### "Missing timestamp or signature"
Make sure your URL has both parameters:
```
?timestamp=1768631176&signature=abc123...
```

## 📝 Notes

- Each URL is **single-use within 5 minutes**
- After 5 minutes, generate a new one
- Your secret **never changes** - no rotation needed
- Still respects the **once-per-day** DCA limit (via customerOrderId)

## 🔧 Advanced: One-Liner for Quick Testing

```bash
# Generate and execute in one command
curl "https://your-site.netlify.app/.netlify/functions/manual-dca?timestamp=$(date +%s)&signature=$(echo -n $(date +%s) | openssl dgst -sha256 -hmac 'YOUR_SECRET' | cut -d' ' -f2)&force=true"
```

⚠️ **Warning**: This will use slightly different timestamps for the signature and URL parameter. Use the helper script instead for reliable results.
