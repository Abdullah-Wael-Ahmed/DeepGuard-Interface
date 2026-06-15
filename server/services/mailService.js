const nodemailer = require("nodemailer");

// Create transport using configured environment variables
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "DeepGuard.sec@gmail.com",
        pass: process.env.EMAIL_PASS || "DeepGuard@2026",
    },
});

/**
 * Send an email notification to an analyst when they are assigned a new incident
 * @param {string} toEmail - Analyst's email address
 * @param {string} analystName - Analyst's name
 * @param {string} incidentRef - Incident reference (e.g. INC-00042)
 * @param {string} incidentTitle - Incident title
 * @param {string} severity - Incident severity
 * @param {string} priority - Incident priority
 * @returns {Promise<boolean>} - True if email sent successfully
 */
async function sendAssignmentEmail(toEmail, analystName, incidentRef, incidentTitle, severity, priority) {
    if (!toEmail) {
        console.warn("[MailService] No target email address provided. Skipping notification.");
        return false;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>DeepGuard Incident Assignment</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #0A192F;
                color: #E6F1FF;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #1D2A3A;
                border: 1px solid #233554;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }
            .header {
                background: linear-gradient(135deg, #111318 0%, #1D2A3A 100%);
                padding: 25px 30px;
                border-b: 2px solid #64FFDA;
                text-align: center;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #64FFDA;
                text-decoration: none;
                letter-spacing: 1px;
            }
            .content {
                padding: 30px;
                line-height: 1.6;
            }
            .greeting {
                font-size: 18px;
                margin-bottom: 20px;
                color: #FFFFFF;
            }
            .alert-box {
                background-color: #0A192F;
                border-left: 4px solid #64FFDA;
                padding: 20px;
                border-radius: 4px;
                margin: 25px 0;
            }
            .field {
                margin-bottom: 10px;
                font-size: 14px;
            }
            .label {
                color: #8892B0;
                font-weight: 600;
                display: inline-block;
                width: 100px;
            }
            .value {
                color: #E6F1FF;
            }
            .btn {
                display: inline-block;
                background-color: #64FFDA;
                color: #0A192F !important;
                text-decoration: none;
                padding: 12px 24px;
                font-weight: bold;
                border-radius: 4px;
                margin-top: 20px;
                text-align: center;
            }
            .btn:hover {
                background-color: #4fd1b0;
            }
            .footer {
                background-color: #111318;
                padding: 20px 30px;
                text-align: center;
                font-size: 12px;
                color: #8892B0;
                border-top: 1px solid #233554;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="logo">🛡️ DEEPGUARD SOC</span>
            </div>
            <div class="content">
                <div class="greeting">Hello ${analystName},</div>
                <p>An administrator has assigned you to a new security incident on the DeepGuard SOC platform. Please review the details below and begin your investigation:</p>
                
                <div class="alert-box">
                    <div class="field">
                        <span class="label">Incident:</span>
                        <span class="value" style="font-weight: bold; color: #64FFDA;">${incidentRef}</span>
                    </div>
                    <div class="field">
                        <span class="label">Title:</span>
                        <span class="value">${incidentTitle}</span>
                    </div>
                    <div class="field">
                        <span class="label">Severity:</span>
                        <span class="value" style="text-transform: uppercase; font-weight: bold; color: ${
                            severity === 'critical' ? '#EF4444' : severity === 'high' ? '#F97316' : '#EAB308'
                        };">${severity}</span>
                    </div>
                    <div class="field">
                        <span class="label">Priority:</span>
                        <span class="value">${priority}</span>
                    </div>
                </div>

                <p>Ensure you update the incident status and keep logs up to date in the timeline as you investigate.</p>
                
                <center>
                    <a href="http://localhost:8080/incidents" class="btn">View Incident Console</a>
                </center>
            </div>
            <div class="footer">
                This is an automated system notification from your DeepGuard SOC instance.<br>
                &copy; 2026 DeepGuard Security. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: `"DeepGuard SOC" <${process.env.EMAIL_USER || "DeepGuard.sec@gmail.com"}>`,
        to: toEmail,
        subject: `[DeepGuard SOC] Assigned Incident: ${incidentRef} - ${incidentTitle.substring(0, 40)}`,
        html: htmlContent,
        text: `Hello ${analystName},\n\nYou have been assigned to a new incident on the DeepGuard SOC platform:\n\nIncident: ${incidentRef}\nTitle: ${incidentTitle}\nSeverity: ${severity.toUpperCase()}\nPriority: ${priority}\n\nPlease review it at http://localhost:8080/incidents\n\nRegards,\nDeepGuard SOC Team`,
    };

    try {
        console.log(`[MailService] Attempting to send assignment mail to ${toEmail} for ${incidentRef}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailService] Assignment mail sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`[MailService] Failed to send assignment mail to ${toEmail}:`, error.message);
        return false;
    }
}

module.exports = {
    sendAssignmentEmail,
};
