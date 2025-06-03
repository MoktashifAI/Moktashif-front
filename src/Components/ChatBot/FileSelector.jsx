import React from 'react';
import { FiFile } from 'react-icons/fi';

export default function FileSelector({ open, onClose, files, loading, onSelect }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#23273a] rounded-lg p-4 max-w-xl w-full max-h-[80vh] flex flex-col shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Previously Uploaded File</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg font-bold"
                        aria-label="Close file selector"
                    >
                        ×
                    </button>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {loading ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-300">Loading files...</div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-4 text-gray-400">No previously uploaded files found</div>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {files.map((file) => (
                                <li key={file.file_id} className="py-3 hover:bg-gray-50 dark:hover:bg-[#23273aee]">
                                    <button
                                        onClick={() => onSelect(file.file_id, file.filename)}
                                        className="w-full text-left flex items-center p-2"
                                    >
                                        <FiFile className="text-blue-500 mr-3" size={18} />
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">{file.filename}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Uploaded: {new Date(file.upload_time).toLocaleString()}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="mt-4 border-t pt-3 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#23273aee]"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
} 