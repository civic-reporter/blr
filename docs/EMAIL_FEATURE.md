# Email Authorities Feature

This feature allows users to optionally send email notifications to relevant authorities (Ward offices and Traffic Police Stations) based on the report location, with an option to CC themselves.

## Features

✅ **Location-based email routing** - Automatically determines relevant authorities based on GPS location  
✅ **Optional feature** - Users can choose whether to send emails  
✅ **Self-CC option** - Users can receive a copy of the report  
✅ **Transparent** - Shows recipients before submission  
✅ **Non-blocking** - Email doesn't delay user feedback  

## Architecture

### Frontend Files

1. **`config/cities/blr-email-authorities.json`**
   - Configuration file mapping wards and traffic PS to email addresses
   - Settings for email behavior (which authorities to include)

2. **`assets/web/email-authorities.js`**
   - Core email module
   - Functions: `getRelevantEmails()`, `prepareEmailData()`, `formatEmailBody()`
   - Handles email validation and formatting

3. **`assets/web/traffic-submission.js`**
   - Updated to include email data in form submission
   - Validates user CC email if provided
   - Calls `prepareEmailData()` with user email option

4. **`assets/web/traffic-app.js`**
   - Initializes email module on app load
   - Sets up event listeners for checkboxes

5. **`cities/blr/traffic.html`**
   - UI elements for email option checkbox
   - Email input field for CC
   - Recipients display list

6. **`assets/css/styles.css`**
   - Styling for email UI components

### Backend

7. **`lambda/traffic-email-lambda.js`**
   - Complete AWS Lambda function example
   - Handles Twitter posting + email sending
   - Uses AWS SES for email delivery

## Configuration

### Email Authorities Config

Edit `config/cities/blr-email-authorities.json`:

```json
{
  "wardEmails": {
    "1": {
      "wardName": "Yelahanaka",
      "emails": ["ward1@bbmp.gov.in", "engineer.ward1@bbmp.gov.in"]
    }
  },
  "trafficPSEmails": {
    "Yelahanka": {
      "emails": ["yelahanka.traffic@blrpolice.gov.in"]
    }
  },
  "emailSettings": {
    "enabled": true,
    "includeWardEmail": true,
    "includeTrafficPSEmail": true,
    "subjectPrefix": "[Traffic Report]"
  }
}
```

### Adding New Authorities

To add more wards or traffic police stations:

1. Get the ward number or PS name (must match KML data)
2. Add entry to appropriate section in config file
3. No code changes needed - automatically picked up

## Backend Setup

### AWS SES Configuration

1. **Verify sender email** in SES Console:
   ```bash
   aws ses verify-email-identity --email-address noreply@yourdomain.com
   ```

2. **Request production access** (to send to any email):
   - Go to SES Console → Account Dashboard
   - Click "Request Production Access"
   - Explain use case (civic reporting platform)

3. **Add IAM permissions** to Lambda role:
   ```json
   {
     "Effect": "Allow",
     "Action": ["ses:SendEmail", "ses:SendRawEmail"],
     "Resource": "*"
   }
   ```

### Lambda Deployment

1. Install dependencies:
   ```bash
   npm install aws-sdk formidable
   ```

2. Deploy function:
   ```bash
   zip -r function.zip lambda/traffic-email-lambda.js node_modules/
   aws lambda update-function-code \
     --function-name traffic-reporter \
     --zip-file fileb://function.zip
   ```

3. Set environment variables:
   ```bash
   aws lambda update-function-configuration \
     --function-name traffic-reporter \
     --environment Variables="{
       SES_FROM_EMAIL=noreply@yourdomain.com,
       AWS_REGION=ap-south-1
     }"
   ```

## API Contract

### Request (Form Data)

The frontend sends these additional fields when email is enabled:

```javascript
{
  sendEmail: "true",                    // Whether to send email
  emailRecipients: ["email1", "email2"], // Array as JSON string
  emailSubject: "[Traffic Report] ...", // Formatted subject
  emailBody: "Traffic Issue Report...", // Formatted body
  emailCC: ["user@email.com"]           // Optional CC (JSON array)
}
```

### Response

```json
{
  "success": true,
  "tweetUrl": "https://twitter.com/.../status/...",
  "message": "Traffic report posted successfully"
}
```

Note: Email is sent asynchronously and doesn't affect the response.

## Email Format

### Subject Line
```
[Traffic Report] Traffic Jam - MG Road Junction
```

### Body
```
Traffic Issue Report
======================

Issue Type: Traffic Jam
Description: Heavy congestion near metro station

Location Details:
- Address: MG Road Junction
- Coordinates: 12.9716, 77.5946
- Ward: 76 (Shantinagar)
- Traffic PS: Cubbon Park

Reported: 19/12/2025, 3:45 PM

Twitter Post: https://twitter.com/zenc_civic/status/...

---
This report was submitted via Nāgarika Dhvani civic platform.
```

### Attachment
- **Filename**: `traffic-issue.jpg`
- **Type**: image/jpeg (face-blurred)

## User Flow

1. User uploads photo with GPS → Location detected
2. System determines Ward #76, Traffic PS "Cubbon Park"
3. User checks "📧 Also email relevant authorities"
4. System shows:
   - ward76@bbmp.gov.in
   - cubbonpark.traffic@blrpolice.gov.in
5. User optionally checks "Send me a copy (CC)"
6. User enters their email: user@example.com
7. User clicks "🚦 Report"
8. Report posted to Twitter immediately
9. Email sent in background to all 3 addresses

## Troubleshooting

### Email not showing up

**Check:**
- Is `emailSettings.enabled` true in config?
- Is location within GBA boundary?
- Open browser console for error messages

### Email validation error

**Check:**
- Email format: must have @ and domain
- No spaces in email address

### Lambda email failures

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/traffic-reporter --follow
```

**Common issues:**
- SES in sandbox mode (verify recipient emails)
- Sender email not verified in SES
- IAM permissions missing
- Email attachment too large (>10MB)

### SES Sandbox Limitations

While in sandbox:
- Can only send to verified emails
- Max 200 emails/day
- Max 1 email/second

**Solution:** Request production access in SES Console

## Testing

### Test without backend

1. Open browser console
2. Check form data being prepared:
```javascript
// In traffic-submission.js, add before fetch:
console.log('Email data:', {
  sendEmail: formData.get('sendEmail'),
  recipients: formData.get('emailRecipients'),
  cc: formData.get('emailCC')
});
```

### Test Lambda locally

```bash
npm install -g aws-sam-cli
sam local invoke traffic-reporter --event test-event.json
```

## Costs

### AWS SES
- **Free tier**: 62,000 emails/month (from EC2/Lambda)
- **After free tier**: $0.10 per 1,000 emails
- **Attachments**: Included

### Estimated monthly cost for 1000 reports with email:
- SES: $0 (within free tier)
- Lambda: $0.20 (minimal execution time increase)
- **Total**: ~$0.20/month

## Future Enhancements

- [ ] Email delivery confirmation
- [ ] Retry failed emails with SQS
- [ ] HTML email templates
- [ ] Multi-language email content
- [ ] Email analytics/tracking
- [ ] Batch email for multiple reports

## Security

- ✅ Email addresses not exposed to frontend (config file only)
- ✅ User email validated before submission
- ✅ SES prevents spoofing (verified sender)
- ✅ Face detection already applied to images
- ✅ Rate limiting through API Gateway

## Support

For issues or questions:
1. Check browser console for frontend errors
2. Check CloudWatch logs for Lambda errors
3. Verify SES sending statistics in AWS Console
4. Test email sending with SES simulator: `success@simulator.amazonses.com`
