const puppeteer = require('puppeteer');

/**
 * Service to handle PDF generation using Puppeteer
 */
class PdfService {
    /**
     * Generates a PDF from a given URL or HTML content
     * @param {string} url - The URL to navigate to
     * @param {string} filename - The name of the file (without extension)
     */
    async generateFromUrl(url, filename = 'DeepGuard_Report') {
        let browser;
        try {
            // Launch headless browser
            browser = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--headless',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();

            // Set viewport size for consistent rendering
            await page.setViewport({ width: 1200, height: 1600 });

            // Navigate to the URL
            // Wait until the network is idle (no more than 2 active connections)
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait a little extra for Recharts animations to finish
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            await browser.close();
            return pdfBuffer;
        } catch (error) {
            console.error('PDF Generation Error:', error);
            if (browser) await browser.close();
            throw error;
        }
    }
}

module.exports = new PdfService();
