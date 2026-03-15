// modal overlay shown during csv uploads - displays a progress bar while uploading,
// a success message when done, or an error message if something went wrong
import React from 'react';
export default function UploadStatus({ open, progress, done, error, filename }) {
  // nothing is rendered when the modal is closed
  if (!open) return null;
  return (
    <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-50 bg-gray-900/70">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] text-center relative">
        <h4 className="font-semibold text-lg mb-2">Uploading {filename}</h4>
        {/* progress bar - hidden once done or errored */}
        {!done && !error && (
          <>
            <div className="h-2 w-full bg-gray-200 rounded">
              <div
                className="h-2 bg-blue-600 rounded"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-gray-700 text-sm">{progress.toFixed(1)}% complete</div>
          </>
        )}
        {done && (
          <div className="mt-2 text-green-700 font-medium">Upload completed!</div>
        )}
        {error && (
          <div className="mt-2 text-red-700 font-medium">Error: {error}</div>
        )}
      </div>
    </div>
  );
}