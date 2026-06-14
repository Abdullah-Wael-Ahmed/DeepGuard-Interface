/**
 * Utility service to handle report exports (CSV/JSON)
 */

export const downloadCSV = (data, filename) => {
    if (!data || !data.length) return;

    const separator = ',';
    const keys = Object.keys(data[0]);
    
    const csvContent = [
        keys.join(separator),
        ...data.map(row => keys.map(key => {
            let cell = row[key] === null || row[key] === undefined ? '' : row[key];
            cell = cell.toString().replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
        }).join(separator))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * Maps the complex report data object to a flat array for CSV export
 * based on the active template type.
 */
export const exportReportToCSV = (templateId, data) => {
    if (!data) return;

    let exportData = [];
    let filename = `DeepGuard_${templateId}_Report_${new Date().toISOString().split('T')[0]}`;

    switch (templateId) {
        case 'executive':
            // Export the threat trends
            exportData = data.trends || [];
            filename = `DeepGuard_Executive_Summary_Trends`;
            break;
        case 'endpoint':
            // Export the Audit Log
            exportData = data.auditLog || [];
            filename = `DeepGuard_Endpoint_Audit_Log`;
            break;
        case 'postmortem':
            // Export the Attack Timeline
            exportData = data.timeline || [];
            filename = `DeepGuard_Incident_Timeline_${data.targetIp}`;
            break;
        case 'ai':
            // Export the Detections Log
            exportData = data.log || [];
            filename = `DeepGuard_AI_Anomalies_Log`;
            break;
        default:
            return;
    }

    if (exportData.length > 0) {
        downloadCSV(exportData, filename);
    } else {
        alert('No tabular data available in this report to export to CSV.');
    }
};
