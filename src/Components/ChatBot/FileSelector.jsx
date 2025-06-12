import React from 'react';
import { FiFile } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileSelector({ open, onClose, files, loading, onSelect, mode = 'all', onModeChange }) {
    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
            >
                <div className="bg-white dark:bg-[#23273a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-0 overflow-hidden">
                    <div className="flex justify-between items-center px-6 pt-6 pb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select Previously Uploaded File</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-red-500 text-xl font-bold transition-colors"
                            aria-label="Close file selector"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex gap-2 px-6 pb-3">
                        <button
                            className={`px-3 py-1.5 rounded font-semibold text-sm transition ${mode === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                            onClick={() => onModeChange && onModeChange('all')}
                            disabled={mode === 'all'}
                        >
                            All My Files
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded font-semibold text-sm transition ${mode === 'conversation' ? 'bg-purple-600 text-white shadow' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                            onClick={() => onModeChange && onModeChange('conversation')}
                            disabled={mode === 'conversation'}
                        >
                            This Conversation
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-grow px-6 pb-6 pt-1" style={{ maxHeight: 400 }}>
                        {loading ? (
                            <div className="text-center py-8 text-blue-500 animate-pulse font-semibold">Loading files...</div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 font-semibold">
                                {mode === 'all' ? 'No previously uploaded files found' : 'No files uploaded for this conversation'}
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {files.map((file) => (
                                    <motion.li
                                        key={file.file_id}
                                        whileHover={{ scale: 1.025, boxShadow: '0 4px 18px 0 rgba(92,135,255,0.10)' }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                                        className="rounded-lg bg-gray-50 dark:bg-[#23273aee] shadow-sm border border-gray-100 dark:border-gray-800 p-0 cursor-pointer"
                                    >
                                        <button
                                            onClick={() => onSelect(file.file_id, file.filename || file.name)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg focus:outline-none"
                                        >
                                            <FiFile className="text-blue-500" size={22} />
                                            <span className="flex flex-col flex-1 min-w-0">
                                                <span className="font-medium text-gray-900 dark:text-white truncate">
                                                    {file.filename || file.name || 'Untitled File'}
                                                </span>
                                                {file.upload_time && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                                                        Uploaded: {new Date(file.upload_time).toLocaleString()}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </motion.li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
} 