import { toast } from 'react-toastify';

let alertCount = 0;
let lastReset = Date.now();
let isThrottled = false;
const MAX_ALERTS_PER_SECOND = 10;

/**
 * Shows a toast notification for alerts with rate-limiting.
 * If more than MAX_ALERTS_PER_SECOND occur within 1 second, 
 * subsequent alerts are suppressed and a warning is shown.
 */
export const showAlertToast = (message) => {
    const now = Date.now();
    
    // Reset counter every second
    if (now - lastReset > 1000) {
        alertCount = 0;
        lastReset = now;
        isThrottled = false;
    }

    alertCount++;

    if (alertCount <= MAX_ALERTS_PER_SECOND) {
        toast.info(message);
    } else if (!isThrottled) {
        isThrottled = true;
        toast.warning("Alert frequency too high. Some notifications are being suppressed for performance.", {
            toastId: 'high-frequency-alert-warning', // Prevent duplicate warnings
        });
    }
};

export const showSuccessToast = (message) => toast.success(message);
export const showErrorToast = (message) => toast.error(message);
export const showInfoToast = (message) => toast.info(message);
export const showWarningToast = (message) => toast.warning(message);
