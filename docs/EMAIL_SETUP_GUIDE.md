# Email Feature Setup Guide - AWS Lambda + SES

Complete step-by-step guide to set up email functionality for traffic reports using AWS Lambda and SES.

---

## Prerequisites

- AWS Account with Lambda and SES access
- AWS CLI installed and configured
- Domain or email address for sending emails
- Python 3.9 or higher

---

## Step 1: AWS SES Setup

### 1.1 Verify Your Sender Email Address

AWS SES requires you to verify the email address you'll send from.

**Using AWS Console:**
1. Go to **AWS Console** → **Simple Email Service (SES)**
2. In the left menu, click **Verified identities**
3. Click **Create identity**
4. Select **Email address**
5. Enter your sender email (e.g., `traffic@yourdomain.com` or `noreply@yourdomain.com`)
6. Click **Create identity**
7. **Check your email inbox** for a verification email from AWS
8. Click the verification link in the email
9. Return to AWS Console and confirm status shows **Verified**

**Using AWS CLI:**
```bash
# Verify an email address
aws ses verify-email-identity --email-address traffic@yourdomain.com

# Check verification status
aws ses get-identity-verification-attributes --identities traffic@yourdomain.com
```

### 1.2 Verify Domain (Optional but Recommended)

For production use, verifying your entire domain is better than individual emails.

**Using AWS Console:**
1. Go to **SES** → **Verified identities**
2. Click **Create identity**
3. Select **Domain**
4. Enter your domain (e.g., `yourdomain.com`)
5. Enable **DKIM signatures** (recommended)
6. Click **Create identity**
7. AWS will provide DNS records (TXT, CNAME, MX)
8. Add these DNS records to your domain registrar
9. Wait for DNS propagation (can take up to 72 hours)
10. Check status in AWS Console

**DNS Records You'll Need to Add:**
- **TXT record** for domain verification
- **CNAME records** (3 records) for DKIM signing
- **MX record** if receiving emails

### 1.3 Request Production Access (Exit Sandbox)

By default, SES is in **sandbox mode** which has restrictions:
- Can only send to verified email addresses
- Limited to 200 emails per day
- Max 1 email per second

**Request Production Access:**
1. Go to **SES** → **Account dashboard**
2. Look for **Your account is in the sandbox** warning
3. Click **Request production access**
4. Fill out the form:
   - **Mail Type**: Transactional
   - **Website URL**: Your app URL or GitHub repo
   - **Use case description**:
     ```
     We are building a civic engagement platform for Bangalore traffic reporting.
     Citizens upload traffic issues with photos, and we need to notify the relevant
     traffic police stations via email. Emails will only be sent to government
     authorities (@ksp.gov.in) when users explicitly choose to email them.
     Expected volume: 50-200 emails per day.
     ```
   - **Bounce/Complaint handling**: Describe how you'll handle bounces
     ```
     We will monitor bounce rates via CloudWatch and remove invalid addresses.
     All emails include unsubscribe links. We will not send to addresses that
     generate complaints.
     ```
5. Click **Submit request**
6. AWS typically responds within 24-48 hours

**Check Your Request Status:**
```bash
aws sesv2 get-account
```

---

## Step 2: IAM Permissions Setup

### 2.1 Create IAM Policy for SES

Create a policy that allows Lambda to send emails via SES.

**Policy JSON:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSendRawEmail",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowSESIdentityRead",
      "Effect": "Allow",
      "Action": [
        "ses:GetIdentityVerificationAttributes",
        "ses:GetSendQuota"
      ],
      "Resource": "*"
    }
  ]
}
```

**Using AWS Console:**
1. Go to **IAM** → **Policies**
2. Click **Create policy**
3. Select **JSON** tab
4. Paste the policy above
5. Click **Next**
6. Name: `LambdaSESEmailPolicy`
7. Description: `Allow Lambda to send emails via SES`
8. Click **Create policy**

**Using AWS CLI:**
```bash
# Create policy
aws iam create-policy \
  --policy-name LambdaSESEmailPolicy \
  --policy-document file://ses-policy.json
```

### 2.2 Attach Policy to Lambda Execution Role

**Find Your Lambda Role:**
1. Go to **Lambda** → Your function → **Configuration** → **Permissions**
2. Note the **Execution role name** (e.g., `traffic-lambda-role-xxxxx`)

**Attach Policy:**
1. Go to **IAM** → **Roles**
2. Search for your Lambda execution role
3. Click the role name
4. Click **Attach policies**
5. Search for `LambdaSESEmailPolicy`
6. Select it and click **Attach policy**

**Using AWS CLI:**
```bash
# Attach policy to role
aws iam attach-role-policy \
  --role-name traffic-lambda-role-xxxxx \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/LambdaSESEmailPolicy
```

---

## Step 3: Lambda Function Setup

### 3.1 Create Lambda Function

**Using AWS Console:**
1. Go to **Lambda** → **Create function**
2. Choose **Author from scratch**
3. Function name: `traffic-email-handler`
4. Runtime: **Python 3.9** or higher
5. Architecture: **x86_64**
6. Click **Create function**

**Using AWS CLI:**
```bash
# Create function (after zipping your code)
zip -r function.zip traffic-email-lambda.py

aws lambda create-function \
  --function-name traffic-email-handler \
  --runtime python3.9 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler traffic-email-lambda.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 512
```

### 3.2 Configure Environment Variables

**Using AWS Console:**
1. Go to your Lambda function
2. Click **Configuration** → **Environment variables**
3. Click **Edit** → **Add environment variable**

**Required Variables:**
| Key | Value | Description |
|-----|-------|-------------|
| `SES_FROM_EMAIL` | `traffic@yourdomain.com` | Verified sender email |
| `AWS_REGION` | `ap-south-1` | AWS region for SES (Mumbai) |
| `API_KEY` | `your_twitter_api_key` | Twitter API key |
| `API_SECRET` | `your_twitter_api_secret` | Twitter API secret |
| `ACCESS_TOKEN` | `your_twitter_access_token` | Twitter access token |
| `ACCESS_SECRET` | `your_twitter_access_secret` | Twitter access secret |

4. Click **Save**

**Using AWS CLI:**
```bash
aws lambda update-function-configuration \
  --function-name traffic-email-handler \
  --environment Variables="{
    SES_FROM_EMAIL=traffic@yourdomain.com,
    AWS_REGION=ap-south-1,
    API_KEY=your_twitter_api_key,
    API_SECRET=your_twitter_api_secret,
    ACCESS_TOKEN=your_twitter_access_token,
    ACCESS_SECRET=your_twitter_access_secret
  }"
```

### 3.3 Install Python Dependencies

Create a deployment package with dependencies:

```bash
# Create a deployment directory
mkdir lambda-package
cd lambda-package

# Copy your Lambda function
cp ../traffic-email-lambda.py .

# Install dependencies
pip install \
  boto3 \
  tweepy \
  --target .

# Zip everything
zip -r ../function.zip .

# Upload to Lambda
aws lambda update-function-code \
  --function-name traffic-email-handler \
  --zip-file fileb://../function.zip
```

### 3.4 Configure Lambda Timeout and Memory

**Using AWS Console:**
1. Go to **Configuration** → **General configuration**
2. Click **Edit**
3. Set **Timeout**: 60 seconds (image processing takes time)
4. Set **Memory**: 512 MB (for Rekognition/Comprehend processing)
5. Click **Save**

### 3.5 Add API Gateway Trigger (for HTTP access)

**Using AWS Console:**
1. Go to your Lambda function
2. Click **Add trigger**
3. Select **API Gateway**
4. Choose **Create a new API**
5. API type: **HTTP API**
6. Security: **Open** (handle CORS in Lambda)
7. Click **Add**
8. Note the **API endpoint URL** (e.g., `https://xxxxx.execute-api.ap-south-1.amazonaws.com/default/traffic-email-handler`)

---

## Step 4: Update Frontend Configuration

### 4.1 Update API Endpoint

Edit `assets/web/config.js` or `config-new.js`:

```javascript
const config = {
  // ... existing config
  apiEndpoint: 'https://xxxxx.execute-api.ap-south-1.amazonaws.com/default/traffic-email-handler',
  // ... rest of config
};
```

### 4.2 Test Email Configuration

The frontend already has email support. Just ensure:
- `blr-email-authorities.json` has correct email addresses
- Email checkbox appears when location is detected
- Form data includes email fields when submitted

---

## Step 5: Testing

### 5.1 Test in SES Sandbox (Before Production)

While in sandbox mode, you can only send to verified emails.

**Verify Test Recipient:**
1. Go to **SES** → **Verified identities**
2. Add your test email (e.g., `nherenow7@gmail.com`)
3. Verify it via the email link

**Test Email Sending:**
```bash
# Test via AWS CLI
aws ses send-email \
  --from traffic@yourdomain.com \
  --destination ToAddresses=nherenow7@gmail.com \
  --message Subject={Data="Test Email"},Body={Text={Data="This is a test"}}
```

### 5.2 Test Lambda Function

**Test Event JSON:**
```json
{
  "requestContext": {
    "http": {
      "method": "POST"
    }
  },
  "headers": {
    "content-type": "multipart/form-data; boundary=----WebKitFormBoundary"
  },
  "body": "------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"category\"\r\n\r\nTraffic Signal Issue\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"lat\"\r\n\r\n12.9716\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"lon\"\r\n\r\n77.5946\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"sendEmail\"\r\n\r\ntrue\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"emailRecipients\"\r\n\r\n[\"nherenow7@gmail.com\"]\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"emailSubject\"\r\n\r\nTest Traffic Report\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"emailBody\"\r\n\r\nThis is a test report\r\n------WebKitFormBoundary--",
  "isBase64Encoded": false
}
```

**Using AWS Console:**
1. Go to Lambda function → **Test** tab
2. Create new test event
3. Paste JSON above
4. Click **Test**
5. Check **Execution results** for errors
6. Check **CloudWatch Logs** for detailed output

### 5.3 Test Full Flow

1. Open traffic reporting page
2. Upload a traffic photo with GPS
3. Fill in description
4. Check **"Email traffic authorities"** checkbox
5. Optionally check **"CC me"** and enter your email
6. Submit the report
7. Check that:
   - Tweet is posted
   - Email arrives at recipient addresses
   - Image attachment is included
   - Tweet URL is in email body

---

## Step 6: Monitoring and Maintenance

### 6.1 Set Up CloudWatch Alarms

**Monitor Email Bounces:**
1. Go to **CloudWatch** → **Alarms**
2. Create alarm for SES bounce rate
3. Set threshold: > 5%
4. Action: Send SNS notification

**Monitor Lambda Errors:**
1. Create alarm for Lambda errors
2. Metric: `Errors` for your Lambda function
3. Set threshold: > 5 in 5 minutes
4. Action: Send SNS notification

### 6.2 Check SES Sending Statistics

```bash
# Get sending quota
aws ses get-send-quota

# Get send statistics (last 2 weeks)
aws ses get-send-statistics
```

**Using AWS Console:**
1. Go to **SES** → **Account dashboard**
2. View:
   - Daily sending quota
   - Max send rate
   - Emails sent in last 24 hours
   - Bounce rate
   - Complaint rate

### 6.3 Review CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/traffic-email-handler --follow

# Filter for email-related logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/traffic-email-handler \
  --filter-pattern "Email"
```

---

## Step 7: Production Checklist

Before going live:

- [ ] SES production access approved
- [ ] Domain verified with DKIM enabled
- [ ] All recipient emails verified (or domain verified)
- [ ] IAM permissions configured correctly
- [ ] Lambda timeout set to 60+ seconds
- [ ] Environment variables set correctly
- [ ] CloudWatch alarms configured
- [ ] Tested email delivery with attachments
- [ ] Tested error handling (invalid emails, etc.)
- [ ] Monitored bounce and complaint rates
- [ ] Updated email config with real authority emails
- [ ] Tested CC functionality
- [ ] Verified email formatting (subject, body, attachment)

---

## Troubleshooting

### Email Not Sending

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/traffic-email-handler --follow
```

**Common Issues:**
1. **"Email address not verified"**
   - Solution: Verify sender email in SES
   - In sandbox: Also verify recipient emails

2. **"Access Denied"**
   - Solution: Check IAM role has SES permissions
   - Attach `LambdaSESEmailPolicy`

3. **"Timeout"**
   - Solution: Increase Lambda timeout to 60 seconds
   - Check if Rekognition/Comprehend calls are slow

4. **"Invalid attachment"**
   - Solution: Check image is under 5MB
   - Verify image_bytes is properly parsed

### High Bounce Rate

**Causes:**
- Invalid email addresses in config
- Typos in email addresses
- Recipient email servers blocking

**Solutions:**
1. Verify all email addresses in `blr-email-authorities.json`
2. Test each email manually with AWS SES CLI
3. Set up bounce handling:
   ```python
   # Add SNS topic for bounces
   ses.set_identity_notification_topic(
       Identity='yourdomain.com',
       NotificationType='Bounce',
       SnsTopic='arn:aws:sns:region:account:bounces'
   )
   ```

### Email Going to Spam

**Solutions:**
1. Enable DKIM signing (verify domain)
2. Add SPF record to DNS:
   ```
   v=spf1 include:amazonses.com ~all
   ```
3. Add DMARC record:
   ```
   v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com
   ```
4. Warm up IP address (gradually increase sending volume)
5. Don't include suspicious words in subject/body

---

## Cost Estimation

### AWS SES Pricing (as of 2025)
- **First 62,000 emails/month**: $0 (free tier)
- **Additional emails**: $0.10 per 1,000 emails
- **Attachments**: $0.12 per GB

**Example:**
- 200 emails/day = 6,000/month = **FREE**
- 500 emails/day = 15,000/month = $0 (within free tier)
- 2,000 emails/day = 60,000/month = **FREE**

### Lambda Pricing
- **First 1M requests/month**: FREE
- **First 400,000 GB-seconds**: FREE
- **Additional requests**: $0.20 per 1M requests

**Your Cost: ~$0/month** for expected volume

---

## Support

**AWS Documentation:**
- [SES Getting Started](https://docs.aws.amazon.com/ses/)
- [Lambda with SES](https://docs.aws.amazon.com/lambda/latest/dg/services-ses.html)

**Debugging:**
- Check CloudWatch Logs: `/aws/lambda/traffic-email-handler`
- Check SES Sending Statistics: AWS Console → SES → Account dashboard
- Test emails: `aws ses send-email` command

**Contact:**
- For issues: Check CloudWatch logs first
- For production access: AWS Support (24-48 hour response)
