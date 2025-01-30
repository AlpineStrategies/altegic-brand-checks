import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { ComplianceReport } from '../types';

interface ComplianceReportViewProps {
  report: ComplianceReport;
}

export function ComplianceReportView({ report }: ComplianceReportViewProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'text-red-500';
      case 'Medium':
        return 'text-yellow-500';
      case 'Low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'High':
        return <AlertTriangle className="h-5 w-5" />;
      case 'Medium':
        return <Info className="h-5 w-5" />;
      case 'Low':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Brand Compliance Score</h2>
        <div className="flex items-center">
          <div
            className="radial-progress text-primary"
            style={{
              '--value': report.score,
              '--size': '8rem',
              '--thickness': '0.5rem',
            } as any}
          >
            {report.score}%
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Issues Identified</h3>
        {report.issues.map((issue, index) => (
          <div
            key={index}
            className="border rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className={getSeverityColor(issue.severity)}>
                {getSeverityIcon(issue.severity)}
              </span>
              <span className="font-medium">{issue.category}</span>
              <span className={`text-sm ${getSeverityColor(issue.severity)}`}>
                {issue.severity} Priority
              </span>
            </div>
            <p className="text-gray-600">{issue.description}</p>
            <p className="text-sm text-gray-500">
              <strong>Recommendation:</strong> {issue.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}